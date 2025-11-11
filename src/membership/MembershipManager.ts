import {
  Contract,
  ContractTransactionResponse,
  Interface,
  BrowserProvider,
  JsonRpcProvider,
} from 'ethers';
import type {
  DeploymentResult,
  MintResult,
  DestroyResult,
  ManagerParams,
  ManagerConfig,
} from '../types';
import { SDKError } from '../types';
import {
  createContract,
  validateAddress,
  resolveProvider,
  getSigner,
  resolveWalletAddress,
} from '../utils';
import { MEMBERSHIP_ABI, MEMBERSHIP_FACTORY_ABI } from '../abi';
import { getDDCConfig } from '../service/api';
import MembershipFactoryJson from '../abi/MembershipFactory.json';
import { BaseManager, ensureContractDeployed, ensureFactoryDeployed } from '../base';

/**
 * Membership Management API
 * Handles Membership contract deployment and operations
 */
export class MembershipManager extends BaseManager<'membership'> {
  protected readonly CONTRACT_ABI = MEMBERSHIP_ABI;
  protected readonly FACTORY_ABI = MEMBERSHIP_FACTORY_ABI;
  protected readonly FACTORY_JSON = MembershipFactoryJson;
  protected readonly CONTRACT_TYPE = 'membership' as const;

  private static instance: MembershipManager | null = null;

  protected getManagerName(): string {
    return 'MembershipManager';
  }

  // Backward compatibility
  public get membershipAddress(): string {
    return this.contractAddress || '';
  }

  public set membershipAddress(address: string) {
    this.contractAddress = address || '';
  }

  constructor(config: ManagerConfig) {
    super(config);
  }

  /**
   * Parse deployed contract address from MembershipDeployed event
   * @protected
   * @returns Contract address from event, or empty string if event not found
   */
  protected parseDeploymentEvent(
    receipt: any,
    expectedName: string,
    expectedSymbol: string
  ): string {
    try {
      // Create a fresh Interface instance to avoid ethers.js v6 internal class check issues
      const factoryInterface = new Interface(MEMBERSHIP_FACTORY_ABI);

      for (const log of receipt.logs) {
        try {
          const parsed = factoryInterface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });

          if (parsed && parsed.name === 'MembershipDeployed') {
            const { contractAddress, name, symbol } = parsed.args;

            if (name === expectedName && symbol === expectedSymbol) {
              this.logger.info(`Found MembershipDeployed event: ${contractAddress}`);
              return contractAddress;
            }
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      this.logger.warn('Could not parse deployment event:', error);
    }

    return '';
  }

  /**
   * Parse snapshot ID from SnapshotCreated event
   * @private
   * @param receipt - Transaction receipt
   * @returns Snapshot ID from event
   * @throws SDKError if event not found
   */
  private async parseSnapshotCreatedEvent(receipt: any): Promise<bigint> {
    try {
      // Create a fresh Interface instance to avoid ethers.js v6 internal class check issues
      const membershipInterface = new Interface(MEMBERSHIP_ABI);

      for (const log of receipt.logs) {
        try {
          const parsed = membershipInterface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });

          if (parsed && parsed.name === 'SnapshotCreated') {
            const snapshotId = parsed.args.snapshotId;
            this.logger.info(`Found SnapshotCreated event: Snapshot ID ${snapshotId}`);
            return BigInt(snapshotId);
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      this.logger.error('Error parsing SnapshotCreated event:', error);
    }

    // If we reach here, event was not found
    throw new SDKError(
      'SnapshotCreated event not found in transaction receipt. The snapshot may have been created but ID could not be determined.',
      'SNAPSHOT_EVENT_NOT_FOUND',
      { txHash: receipt.hash }
    );
  }

  /**
   * Parse Transfer event to verify minting
   * @private
   * @param receipt - Transaction receipt
   * @param expectedTokenId - Expected token ID that should be minted
   * @param expectedTo - Expected recipient address hash
   * @returns Parsed transfer information
   * @throws SDKError if event not found or parameters don't match
   */
  private async parseTransferEvent(
    receipt: any,
    expectedTokenId: bigint,
    expectedTo: string
  ): Promise<{ from: string; to: string; tokenId: bigint }> {
    try {
      // Create a fresh Interface instance to avoid ethers.js v6 internal class check issues
      const membershipInterface = new Interface(MEMBERSHIP_ABI);

      for (const log of receipt.logs) {
        try {
          const parsed = membershipInterface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });

          if (parsed && parsed.name === 'Transfer') {
            const { from, to, tokenId } = parsed.args;
            const tokenIdBigInt = BigInt(tokenId);

            this.logger.info(
              `Found Transfer event: from=${from}, to=${to}, tokenId=${tokenIdBigInt}`
            );

            // Verify the event matches expected parameters
            // For minting, 'from' should be bytes32 zero value
            const isZeroAddress = from.toLowerCase() === this.BYTES32_ZERO;

            if (!isZeroAddress) {
              this.logger.warn(
                `Transfer event 'from' is not bytes32 zero value, this may not be a mint operation. Got: ${from}`
              );
            }

            // Verify tokenId matches
            if (tokenIdBigInt !== expectedTokenId) {
              throw new SDKError(
                `Minted tokenId (${tokenIdBigInt}) does not match expected tokenId (${expectedTokenId})`,
                'TOKEN_ID_MISMATCH',
                { expected: expectedTokenId, actual: tokenIdBigInt }
              );
            }

            // Verify recipient hash matches
            if (to.toLowerCase() !== expectedTo.toLowerCase()) {
              throw new SDKError(
                `Minted to address hash (${to}) does not match expected hash (${expectedTo})`,
                'RECIPIENT_MISMATCH',
                { expected: expectedTo, actual: to }
              );
            }

            return {
              from,
              to,
              tokenId: tokenIdBigInt,
            };
          }
        } catch (error) {
          // Re-throw SDKError
          if (error instanceof SDKError) throw error;
          continue;
        }
      }
    } catch (error) {
      // Re-throw SDKError
      if (error instanceof SDKError) throw error;
      this.logger.error('Error parsing Transfer event:', error);
    }

    // If we reach here, event was not found
    throw new SDKError(
      'Transfer event not found in transaction receipt. The token may have been minted but could not be verified.',
      'TRANSFER_EVENT_NOT_FOUND',
      { txHash: receipt.hash, expectedTokenId, expectedTo }
    );
  }

  /**
   * Parse Transfer event to verify burning (destroying)
   * @private
   * @param receipt - Transaction receipt
   * @param expectedTokenId - Expected token ID that should be burned
   * @param expectedFrom - Expected owner address hash
   * @returns Parsed burn information
   * @throws SDKError if event not found or parameters don't match
   */
  private async parseBurnEvent(
    receipt: any,
    expectedTokenId: bigint,
    expectedFrom: string
  ): Promise<{ from: string; to: string; tokenId: bigint }> {
    try {
      // Create a fresh Interface instance to avoid ethers.js v6 internal class check issues
      const membershipInterface = new Interface(MEMBERSHIP_ABI);

      for (const log of receipt.logs) {
        try {
          const parsed = membershipInterface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });

          if (parsed && parsed.name === 'Transfer') {
            const { from, to, tokenId } = parsed.args;
            const tokenIdBigInt = BigInt(tokenId);

            // this.logger.info(
            //   `Found Transfer event: from=${from}, to=${to}, tokenId=${tokenIdBigInt}`
            // );

            // Verify the event matches expected parameters
            // For burning, 'to' should be bytes32 zero value
            const isZeroAddress = to.toLowerCase() === this.BYTES32_ZERO;

            if (!isZeroAddress) {
              this.logger.warn(
                `Transfer event 'to' is not bytes32 zero value, this may not be a burn operation. Got: ${to}`
              );
            }

            // Verify tokenId matches
            if (tokenIdBigInt !== expectedTokenId) {
              throw new SDKError(
                `Burned tokenId (${tokenIdBigInt}) does not match expected tokenId (${expectedTokenId})`,
                'TOKEN_ID_MISMATCH',
                { expected: expectedTokenId, actual: tokenIdBigInt }
              );
            }

            // Verify owner hash matches
            if (from.toLowerCase() !== expectedFrom.toLowerCase()) {
              throw new SDKError(
                `Burned from address hash (${from}) does not match expected hash (${expectedFrom})`,
                'OWNER_MISMATCH',
                { expected: expectedFrom, actual: from }
              );
            }

            return {
              from,
              to,
              tokenId: tokenIdBigInt,
            };
          }
        } catch (error) {
          // Re-throw SDKError
          if (error instanceof SDKError) throw error;
          continue;
        }
      }
    } catch (error) {
      // Re-throw SDKError
      if (error instanceof SDKError) throw error;
      this.logger.error('Error parsing Transfer (burn) event:', error);
    }

    // If we reach here, event was not found
    throw new SDKError(
      'Transfer event not found in transaction receipt. The token may have been burned but could not be verified.',
      'BURN_EVENT_NOT_FOUND',
      { txHash: receipt.hash, expectedTokenId, expectedFrom }
    );
  }

  /**
   * Init Instance of MembershipManager
   * Supports both BrowserProvider and JsonRpcProvider modes
   *
   * @param manageConfig - Configuration object
   * @returns MembershipManager instance
   *
   * @example
   * ```typescript
   * // BrowserProvider mode - user constructs BrowserProvider
   * import { BrowserProvider } from 'ethers';
   * const manager = await MembershipManager.init({
   *   walletAddress: '0x...',
   *   provider: new BrowserProvider(window.ethereum),
   *   debug: true
   * });
   *
   * // JsonRpcProvider mode - using descriptor (SDK constructs for you to avoid version conflicts)
   * // rpcUrl and chainId are automatically fetched from getDDCConfig API
   * const manager = await MembershipManager.init({
   *   walletAddress: '0x...',
   *   provider: { type: 'jsonRpc' }, // rpcUrl and chainId auto-filled from API
   *   signer: { privateKey: '0x...' },
   *   debug: true
   * });
   * ```
   **/
  static async init(manageConfig: ManagerParams): Promise<MembershipManager> {
    if (!manageConfig) {
      throw new SDKError('Manager configuration cannot be empty', 'INVALID_PARAMETER', {
        manageConfig,
      });
    }

    const { walletAddress, provider, signer, debug } = manageConfig;

    // Resolve wallet address: if JsonRpcProvider mode and signer provided, extract from privateKey
    // Wallet object has address property that can be accessed synchronously
    const resolvedWalletAddress = resolveWalletAddress(provider, walletAddress, signer);

    // Query ddc config from api first to get network config
    // This allows us to auto-fill rpcUrl/chainId for JsonRpcProvider mode
    const result = await getDDCConfig({ address: resolvedWalletAddress });

    if (!result.success) {
      throw new SDKError('Failed to get DDC config', 'DDC_CONFIG_ERROR', { result });
    }

    const { membership_factory_address, network, metadata_url, membership_address } =
      result.data.data;

    // Resolve provider from descriptor or use directly
    // For JsonRpcProviderDescriptor, network config can auto-fill missing rpcUrl/chainId
    const resolvedProvider = resolveProvider(provider, network);

    // Validate signer config for JsonRpcProvider mode
    if (resolvedProvider instanceof JsonRpcProvider && !signer) {
      throw new SDKError(
        'Signer configuration is required for JsonRpcProvider mode. Please provide signer with privateKey.',
        'MISSING_SIGNER_CONFIG',
        { providerType: 'JsonRpcProvider' }
      );
    }

    const config: ManagerConfig = {
      provider: resolvedProvider,
      debug: debug || false,
      network: network,
      factoryAddress: membership_factory_address,
      signerConfig: signer,
    };
    this.instance = new MembershipManager(config);
    await this.instance.ensureNetwork();

    if (config.factoryAddress) {
      validateAddress(config.factoryAddress, 'Factory address');
      this.instance.factoryAddress = config.factoryAddress;
      if (!this.instance.provider) {
        throw new SDKError('Provider is not available', 'PROVIDER_NOT_AVAILABLE');
      }
      const signerInstance = await getSigner(this.instance.provider, this.instance.signerConfig);
      this.instance.factoryContract = createContract(
        config.factoryAddress,
        MEMBERSHIP_FACTORY_ABI,
        signerInstance
      );
    }

    if (membership_address) {
      this.instance.deployedContracts = [...membership_address];
    }

    if (metadata_url) {
      this.instance.metadataUrl = metadata_url;
    }

    return this.instance;
  }

  /**
   * Deploy MembershipFactory contract (alias for base deployFactory)
   * @deprecated Use deployFactory() instead
   */
  async deployMembershipFactory(): Promise<DeploymentResult> {
    return this.deployFactory();
  }

  /**
   * Deploy a new Membership contract via factory (alias for base deployContract)
   * @deprecated Use deployContract() instead
   */
  @ensureFactoryDeployed
  async deployMembership(name: string, symbol: string): Promise<DeploymentResult> {
    return this.deployContract(name, symbol);
  }

  /**
   * Create a new snapshot of current members
   *
   * Implementation strategy:
   * 1. Execute the createSnapshot transaction
   * 2. Parse the SnapshotCreated event from receipt to get snapshot ID
   * 3. This avoids race conditions and extra RPC calls
   *
   * @returns Snapshot ID
   */
  @ensureContractDeployed
  async createSnapshot(): Promise<bigint> {
    await this.ensureNetwork();
    const contract = await this.getContract();

    try {
      // Execute createSnapshot transaction
      // this.logger.info('Sending createSnapshot transaction...');
      const tx: ContractTransactionResponse = await contract.createSnapshot();

      // this.logger.info(`Snapshot transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      // this.logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);
      // Parse snapshot ID from SnapshotCreated event
      const snapshotId = await this.parseSnapshotCreatedEvent(receipt);
      // this.logger.info(`✓ Snapshot created successfully. Snapshot ID: ${snapshotId}`);
      return snapshotId;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to create snapshot:', error);

      const contractAddress = this.getContractAddress();
      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract call failed. You may not have permission to create snapshots.',
          'CONTRACT_CALL_FAILED',
          { contractAddress, originalError: error.message }
        );
      }

      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new SDKError('Insufficient funds to pay for gas fees.', 'INSUFFICIENT_FUNDS', {
          contractAddress,
          error: error.message,
        });
      }

      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        throw new SDKError('Transaction was rejected by user.', 'USER_REJECTED', {
          contractAddress,
          error: error.message,
        });
      }

      throw new SDKError(
        `Failed to create snapshot: ${error.message || error}`,
        'CREATE_SNAPSHOT_ERROR',
        { contractAddress, error: error.message || error }
      );
    }
  }

  /**
   * Mint a new membership token
   *
   * Implementation strategy:
   * 1. Execute the mint transaction
   * 2. Parse the Transfer event from receipt to verify minting
   * 3. Return complete mint result with verification
   *
   * @param tokenId - Token ID to mint
   * @param addressHash - Member address hash (bytes32)
   * @returns Mint result with token information and transaction details
   */
  @ensureContractDeployed
  async mintMembership(tokenId: bigint, addressHash: string): Promise<MintResult> {
    await this.ensureNetwork();
    const contract = await this.getContract();

    // Validate keyHash is provided
    if (!addressHash || !addressHash.trim()) {
      throw new SDKError('keyHash is required for minting', 'MISSING_KEY_HASH', { addressHash });
    }

    // Validate keyHash format
    if (addressHash.length !== 66 || !addressHash.startsWith('0x')) {
      throw new SDKError(
        'Invalid keyHash format. Expected bytes32 (0x + 64 hex characters)',
        'INVALID_PARAMETER',
        { addressHash }
      );
    }

    // Validate keyHash is not zero (contract requirement)
    if (addressHash.toLowerCase() === this.BYTES32_ZERO.toLowerCase()) {
      throw new SDKError(
        'keyHash cannot be bytes32 zero value. Please provide a valid key hash generated from keccak256(key).',
        'INVALID_KEY_HASH',
        { addressHash }
      );
    }

    try {
      // Step 1: Execute mint transaction
      // this.logger.info('Step 1/2: Sending mint transaction...');
      const tx: ContractTransactionResponse = await contract.mint(tokenId, addressHash);

      // this.logger.info(`Mint transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }
      // this.logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);
      const transferEvent = await this.parseTransferEvent(receipt, tokenId, addressHash);

      // this.logger.info(
      //   `✓ Membership token #${transferEvent.tokenId} minted successfully to ${transferEvent.to}`
      // );

      return {
        tokenId: transferEvent.tokenId,
        to: transferEvent.to,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to mint membership:', error);

      const contractAddress = this.getContractAddress();
      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract call failed. The token may already exist or you may not have minting permission.',
          'CONTRACT_CALL_FAILED',
          { contractAddress, tokenId, addressHash, originalError: error.message }
        );
      }

      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new SDKError('Insufficient funds to pay for gas fees.', 'INSUFFICIENT_FUNDS', {
          contractAddress,
          error: error.message,
        });
      }

      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        throw new SDKError('Transaction was rejected by user.', 'USER_REJECTED', {
          contractAddress,
          error: error.message,
        });
      }

      throw new SDKError(`Failed to mint membership: ${error.message || error}`, 'MINT_ERROR', {
        contractAddress,
        tokenId,
        addressHash,
        error: error.message || error,
      });
    }
  }

  /**
   * Destroy (burn) a membership token
   *
   * Implementation strategy:
   * 1. Execute the destroy transaction
   * 2. Parse the Transfer event (burn: from owner to zero address) to verify destruction
   * 3. Return complete destroy result with verification
   *
   * @param tokenId - Token ID to destroy
   * @param addressHash - Member address hash (bytes32) for verification
   * @returns Destroy result with token information and transaction details
   */
  @ensureContractDeployed
  async destroyMembership(tokenId: bigint, addressHash: string): Promise<DestroyResult> {
    await this.ensureNetwork();
    const contract = await this.getContract();

    // Validate parameters
    if (!tokenId) {
      throw new SDKError('tokenId is required for destroying', 'MISSING_TOKEN_ID', { tokenId });
    }

    if (!addressHash || !addressHash.trim()) {
      throw new SDKError('Destroy key cannot be empty', 'INVALID_PARAMETER', { addressHash });
    }

    try {
      // Step 1: Execute destroy transaction
      const tx: ContractTransactionResponse = await contract.destroy(tokenId, addressHash);

      const receipt = await tx.wait();
      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      // Step 2: Verify destruction via Transfer event (burn)
      const burnEvent = await this.parseBurnEvent(receipt, tokenId, addressHash);

      return {
        tokenId: burnEvent.tokenId,
        from: burnEvent.from,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to destroy membership:', error);

      const contractAddress = this.getContractAddress();
      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract call failed. The token may not exist or you may not have permission to destroy it.',
          'CONTRACT_CALL_FAILED',
          { contractAddress, tokenId, addressHash, originalError: error.message }
        );
      }

      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new SDKError('Insufficient funds to pay for gas fees.', 'INSUFFICIENT_FUNDS', {
          contractAddress,
          error: error.message,
        });
      }

      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        throw new SDKError('Transaction was rejected by user.', 'USER_REJECTED', {
          contractAddress,
          error: error.message,
        });
      }

      throw new SDKError(
        `Failed to destroy membership: ${error.message || error}`,
        'DESTROY_ERROR',
        { contractAddress, tokenId, addressHash, error: error.message || error }
      );
    }
  }

  /**
   * Get contract address
   * @returns Contract address
   * @deprecated Use getContractAddress() instead
   */
  @ensureContractDeployed
  getMembershipAddress(): string {
    return this.getContractAddress()!;
  }

  /**
   * Get Membership contract instance
   * @param contractAddress - Optional membership contract address. If not provided, uses the stored address.
   * @returns Contract instance
   * @deprecated Use getContract() instead
   */
  @ensureContractDeployed
  async getMembershipContract(contractAddress?: string): Promise<Contract> {
    return this.getContract(contractAddress);
  }

  /**
   * Get total supply of memberships
   * @returns Total supply (0 if no tokens minted yet)
   */
  @ensureContractDeployed
  async getTotalSupply(): Promise<bigint> {
    try {
      const supply = await (await this.getContract()).totalSupply();
      return BigInt(supply);
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      throw new SDKError(`Failed to get total supply: ${error.message}`, 'CONTRACT_CALL_ERROR', {
        contractAddress: this.getContractAddress(),
        error: error.message,
      });
    }
  }

  /**
   * Get member snapshot (list of member address hashes)
   * @param snapshotId - Snapshot ID
   * @returns Array of member address hashes (empty array if snapshot doesn't exist)
   */
  @ensureContractDeployed
  async getMemberSnapshot(snapshotId: bigint): Promise<string[]> {
    if (snapshotId === undefined || snapshotId === null) {
      throw new SDKError('Snapshot ID is required', 'INVALID_PARAMETER', { snapshotId });
    }

    const contract = await this.getContract();

    try {
      const members = await contract.getMemberSnapshot(snapshotId);
      return members || [];
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error(`Failed to get snapshot #${snapshotId}:`, error.message);

      if (error.code === 'CALL_EXCEPTION') {
        this.logger.warn(`Snapshot #${snapshotId} does not exist, returning empty array`);
        return [];
      }

      throw new SDKError(`Failed to get member snapshot: ${error.message}`, 'CONTRACT_CALL_ERROR', {
        contractAddress: this.getContractAddress(),
        snapshotId,
        error: error.message,
      });
    }
  }

  /**
   * Get latest snapshot ID
   * @returns Latest snapshot ID (0 if no snapshots created yet)
   */
  @ensureContractDeployed
  async getLatestSnapshotId(): Promise<bigint> {
    const contract = await this.getContract();
    const contractAddress = this.getContractAddress();

    try {
      const snapshotId = await contract.getLatestSnapshotId();
      return BigInt(snapshotId);
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to get latest snapshot ID:', error.message);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract does not exist or is not deployed at this address',
          'CONTRACT_NOT_FOUND',
          { contractAddress }
        );
      }

      throw new SDKError(
        `Failed to get latest snapshot ID: ${error.message}`,
        'CONTRACT_CALL_ERROR',
        { contractAddress, error: error.message }
      );
    }
  }

  /**
   * Check if member is in snapshot
   * @param snapshotId - Snapshot ID
   * @param addressHash - Member address hash (bytes32)
   * @returns True if member is in snapshot, false otherwise
   */
  @ensureContractDeployed
  async isMemberInSnapshot(snapshotId: bigint, addressHash: string): Promise<boolean> {
    if (snapshotId === undefined || snapshotId === null) {
      throw new SDKError('Snapshot ID is required', 'INVALID_PARAMETER', { snapshotId });
    }

    if (!addressHash || !addressHash.trim()) {
      throw new SDKError('Address hash is required', 'INVALID_PARAMETER', { addressHash });
    }

    const contract = await this.getContract();

    try {
      const isMember = await contract.isMemberInSnapshot(snapshotId, addressHash);
      return isMember;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to check member in snapshot:', error.message);

      if (error.code === 'CALL_EXCEPTION') {
        return false;
      }

      throw new SDKError(
        `Failed to check member in snapshot: ${error.message}`,
        'CONTRACT_CALL_ERROR',
        {
          contractAddress: this.getContractAddress(),
          snapshotId,
          addressHash,
          error: error.message,
        }
      );
    }
  }
}
