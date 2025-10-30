import { Contract, ContractTransactionResponse, ContractFactory, Provider, BrowserProvider, Interface } from 'ethers';
import type {
  DeploymentResult,
  MintResult,
  DestroyResult,
  DDCChainConfig,
  ManagerParams,
  ManagerConfig,
} from '../types';
import { SDKError } from '../types';
import { createContract, validateAddress, ensureCorrectNetwork, Logger, getSigner } from '../utils';
import { MEMBERSHIP_ABI, MEMBERSHIP_FACTORY_ABI } from '../abi';
import { getDDCConfig, setContractAddress, setFactoryAddress } from '../service/api';
import { ensureFactoryDeployed, ensureMembershipDeployed, addAddress } from '../utils/contract';
import MembershipFactoryJson from '../abi/MembershipFactory.json';

/**
 * Membership Management API
 * Handles Membership contract deployment and operations
 */
export class MembershipManager {
  // bytes32 zero value (64 hex characters = 32 bytes) - used for mint/burn verification
  private static readonly BYTES32_ZERO =
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  private provider?: Provider;
  private factoryContract?: Contract;
  private factoryAddress?: string;
  private networkConfig?: DDCChainConfig;
  private logger: Logger;
  private membershipAddress?: string;
  private static instance: MembershipManager | null = null;

  // Store deployed contract addresses
  private deployedContracts: Array<string> = [];

  constructor(config: ManagerConfig) {
    this.logger = new Logger(config?.debug || false);
    if (config?.provider && config?.network) {
      const { provider, network } = config;
      this.provider = provider;
      this.networkConfig = network;

      this.logger.info('Initializing MembershipManager', {
        hasFactory: !!config.factoryAddress,
        network: network.chain_name || 'not specified',
        chain_id: network.chain_id,
      });
    }
  }

  /**
   * Parse deployed contract address from MembershipDeployed event
   * @private
   * @returns Contract address from event, or empty string if event not found
   */
  private parseDeploymentEvent(receipt: any, expectedName: string, expectedSymbol: string): string {
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
            const isZeroAddress = from.toLowerCase() === MembershipManager.BYTES32_ZERO;

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
            const isZeroAddress = to.toLowerCase() === MembershipManager.BYTES32_ZERO;

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
   * Ensure the wallet is connected to the correct network
   * @private
   */
  private async ensureNetwork(): Promise<void> {
    if (!this.networkConfig) {
      this.logger.warn('No network config provided, skipping network validation');
      return;
    }

    try {
      await ensureCorrectNetwork(this.provider as BrowserProvider, this.networkConfig, this.logger.debug);
    } catch (error) {
      this.logger.error('Network validation failed:', error);
      throw error;
    }
  }

  /**
   * Init Instance of MembershipManager
   * @param config - Configuration object
   * @returns MembershipManager instance
   **/
  static async init(manageConfig: ManagerParams): Promise<MembershipManager> {
    if (!manageConfig) {
      throw new SDKError('Manager configuration cannot be empty', 'INVALID_PARAMETER', {
        manageConfig,
      });
    }

    const { walletAddress, provider, debug } = manageConfig;
    // query ddc config from api
    const result = await getDDCConfig({ address: walletAddress });

    if (result.success) {
      const { membership_factory_address, network } = result.data.data;
      const config: ManagerConfig = {
        provider,
        debug: debug || false,
        network: network,
        factoryAddress: membership_factory_address,
      };
      this.instance = new MembershipManager(config);
      await this.instance.ensureNetwork();


      if (config.factoryAddress) {
        validateAddress(config.factoryAddress, 'Factory address');
        this.instance.factoryAddress =  config.factoryAddress;
        const signer = await getSigner(this.instance.provider as BrowserProvider);
        this.instance.factoryContract = createContract(config.factoryAddress, MEMBERSHIP_FACTORY_ABI, signer);
      }

      return this.instance;
    }
    throw new SDKError('Failed to get DDC config', 'DDC_CONFIG_ERROR', { result });
  }

  /**
   * Deploy MembershipFactory contract
   * Users must deploy the factory contract before deploying Membership contracts
   *
   * @returns Deployment result with factory contract address
   * @throws {SDKError} If deployment fails or user rejects transaction
   */
  async deployMembershipFactory(): Promise<DeploymentResult> {
    if (!this.provider) {
      throw new SDKError('provider is required for factory deployment', 'MISSING_SIGNER');
    }

    // this.logger.info('Deploying MembershipFactory contract...');
    await this.ensureNetwork();

    try {
      // Create contract factory using bytecode from ABI
      const bytecode = MembershipFactoryJson.bytecode.object;

      if (!bytecode) {
        throw new SDKError(
          'Factory bytecode not found in ABI',
          'MISSING_BYTECODE'
        );
      }

      const signer = await getSigner(this.provider as BrowserProvider);
      const factory = new ContractFactory(MEMBERSHIP_FACTORY_ABI, bytecode, signer);

      // Deploy the contract
      // this.logger.info('Sending factory deployment transaction...');
      const contract = await factory.deploy();
      // this.logger.info(`Factory deployment transaction sent: ${contract.deploymentTransaction()?.hash}`);

      // Wait for deployment to complete
      await contract.waitForDeployment();

      const factoryAddress = await contract.getAddress();
      // this.logger.info(`MembershipFactory deployed successfully at ${factoryAddress}`);

      // Store the factory address and create factory contract instance
      this.factoryAddress = factoryAddress;
      this.factoryContract = createContract(factoryAddress, MEMBERSHIP_FACTORY_ABI, signer);
      const deploymentTx = contract.deploymentTransaction();
      await setFactoryAddress({ address: await signer!.getAddress()!, factoryAddress: factoryAddress, type: 'membership' });

      return {
        contractAddress: factoryAddress,
        transactionHash: deploymentTx?.hash || '',
        blockNumber: deploymentTx?.blockNumber || 0,
      };
    } catch (error: any) {
      this.logger.error('Factory deployment failed:', error);

      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new SDKError('Insufficient funds to pay for gas fees.', 'INSUFFICIENT_FUNDS', {
          error: error.message,
        });
      }

      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        throw new SDKError('Transaction was rejected by user.', 'USER_REJECTED', {
          error: error.message,
        });
      }

      throw new SDKError(
        `Failed to deploy MembershipFactory: ${error.message || error}`,
        'FACTORY_DEPLOYMENT_ERROR',
        { error: error.message || error }
      );
    }
  }

  /**
   * Deploy a new Membership contract via factory
   *
   * Implementation strategy:
   * 1. Ensure factory contract is deployed and set (via @ensureFactoryDeployed decorator)
   * 2. Use staticCall to get the deployment address BEFORE sending transaction
   * 3. Execute the actual deployment transaction
   * 4. Verify deployment via event logs (optional but recommended)
   *
   * @param name - Membership contract name
   * @param symbol - Membership contract symbol
   * @returns Deployment result with contract address
   * @throws {SDKError} If factory contract is not deployed or set
   */
  @ensureFactoryDeployed
  async deployMembership(name: string, symbol: string): Promise<DeploymentResult> {
    if (!name || !name.trim()) {
      throw new SDKError('Contract name cannot be empty', 'INVALID_PARAMETER', { name });
    }

    if (!symbol || !symbol.trim()) {
      throw new SDKError('Contract symbol cannot be empty', 'INVALID_PARAMETER', { symbol });
    }

    // this.logger.info('Deploying new Membership contract', { name, symbol });
    await this.ensureNetwork();

    try {
      // Step 1: Pre-calculate deployment address using staticCall
      // staticCall simulates the transaction and returns the function's return value
      // without actually sending a transaction or changing blockchain state
      // this.logger.info('Step 1/3: Calculating deployment address via staticCall...');

      let predictedAddress: string;
      try {
        predictedAddress = await this.factoryContract!.deployMembership.staticCall(name, symbol);
        // this.logger.info(`Predicted deployment address: ${predictedAddress}`);
      } catch (staticError: any) {
        this.logger.error('staticCall failed:', staticError);
        throw new SDKError(
          `Failed to predict deployment address. This might indicate the deployment will fail. Error: ${
            staticError.message || staticError
          }`,
          'STATICCALL_FAILED',
          { name, symbol, error: staticError.message }
        );
      }

      // Step 2: Execute actual deployment transaction
      // this.logger.info('Step 2/3: Sending deployment transaction to blockchain...');
      const tx: ContractTransactionResponse = await this.factoryContract!.deployMembership(
        name,
        symbol
      );

      // this.logger.info(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      // this.logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);

      // Step 3: Verify deployment via event (for extra validation)
      // this.logger.info('Step 3/3: Verifying deployment via event logs...');
      const eventAddress = this.parseDeploymentEvent(receipt, name, symbol);

      if (eventAddress) {
        if (eventAddress.toLowerCase() === predictedAddress.toLowerCase()) {
          // this.logger.info('✓ Event address matches prediction');
        } else {
          this.logger.warn(
            `⚠ Address mismatch! Predicted: ${predictedAddress}, Event: ${eventAddress}`
          );
          // Use event address as it's the actual deployed address
          predictedAddress = eventAddress;
        }
      } else {
        this.logger.warn('Could not find MembershipDeployed event, using predicted address');
      }

      const deployedAddress = predictedAddress;

      // Store deployed contract address
      this.deployedContracts = addAddress(this.deployedContracts, deployedAddress);
      await setContractAddress({ address: deployedAddress, contract: deployedAddress, type: 'membership' });
      this.membershipAddress = deployedAddress;
      // this.logger.info(`✓ Membership contract deployed successfully at ${deployedAddress}`);
      return {
        contractAddress: deployedAddress,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      // Re-throw SDKError as-is
      if (error instanceof SDKError) throw error;

      this.logger.error('Deployment failed:', error);

      // Handle specific ethers.js error codes
      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract call failed. The factory might reject this deployment (duplicate name/symbol, or permission issue).',
          'CONTRACT_CALL_FAILED',
          { name, symbol, reason: error.reason, originalError: error.message }
        );
      }

      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new SDKError('Insufficient funds to pay for gas fees.', 'INSUFFICIENT_FUNDS', {
          error: error.message,
        });
      }

      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        throw new SDKError('Transaction was rejected by user.', 'USER_REJECTED', {
          error: error.message,
        });
      }

      if (error.code === 'NONCE_EXPIRED') {
        throw new SDKError('Transaction nonce expired. Please try again.', 'NONCE_EXPIRED', {
          error: error.message,
        });
      }

      // Generic error
      throw new SDKError(
        `Failed to deploy Membership contract: ${error.message || error}`,
        'DEPLOYMENT_ERROR',
        { name, symbol, error: error.message || error }
      );
    }
  }

  /**
   * Transfer ownership of the contract
   * @param contractAddress - Membership contract address
   * @param newOwner - New owner address
   * @returns Transaction hash
   */
  @ensureMembershipDeployed
  async transferOwnership(newOwner: string): Promise<string> {
    // this.logger.info(`Transferring ownership to ${newOwner}`);
    await this.ensureNetwork();

    validateAddress(newOwner, 'New owner address');
    const contract = this.getMembershipContract();
    const contractAddress = this.getMembershipAddress();

    try {
      // this.logger.info('Sending transferOwnership transaction...');
      const tx: ContractTransactionResponse = await (await contract).transferOwnership(newOwner);

      // this.logger.info(
      //   `Transfer ownership transaction sent: ${tx.hash}. Waiting for confirmation...`
      // );
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      // this.logger.info(`Ownership transferred successfully. Transaction: ${receipt.hash}`);
      return receipt.hash;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to transfer ownership:', error);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract call failed. You may not be the current owner.',
          'CONTRACT_CALL_FAILED',
          { contractAddress, newOwner, originalError: error.message }
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
        `Failed to transfer ownership: ${error.message || error}`,
        'TRANSFER_OWNERSHIP_ERROR',
        { contractAddress, newOwner, error: error.message || error }
      );
    }
  }

  /**
   * Create a new snapshot of current members
   *
   * Implementation strategy:
   * 1. Execute the createSnapshot transaction
   * 2. Parse the SnapshotCreated event from receipt to get snapshot ID
   * 3. This avoids race conditions and extra RPC calls
   *
   * @param contractAddress - Membership contract address
   * @returns Snapshot ID
   */
  @ensureMembershipDeployed
  async createSnapshot(): Promise<bigint> {
    // this.logger.info('Creating snapshot of current members...');
    await this.ensureNetwork();

    const contract = this.getMembershipContract();

    try {
      // Execute createSnapshot transaction
      // this.logger.info('Sending createSnapshot transaction...');
      const tx: ContractTransactionResponse = await (await contract).createSnapshot();

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

      const contractAddress = this.getMembershipAddress();
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
  @ensureMembershipDeployed
  async mintToken(tokenId: bigint, addressHash: string): Promise<MintResult> {
    // this.logger.info(`Minting membership token #${tokenId} to ${addressHash}`);
    await this.ensureNetwork();

    const contract =await this.getMembershipContract();

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
      // Step 2: Verify minting via Transfer event
      // this.logger.info('Step 2/2: Verifying mint via Transfer event...');
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

      const contractAddress = this.getMembershipAddress();
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
   * @param contractAddress - Membership contract address
   * @param tokenId - Token ID to destroy
   * @param addressHash - Member address hash (bytes32) for verification
   * @returns Destroy result with token information and transaction details
   */
  @ensureMembershipDeployed
  async destroyToken(tokenId: bigint, addressHash: string): Promise<DestroyResult> {
    // this.logger.info(`Destroying membership token #${tokenId} from ${addressHash}`);
    await this.ensureNetwork();

    const contract = this.getMembershipContract();
    const contractAddress = this.getMembershipAddress();

    try {
      // Step 1: Execute destroy transaction
      // this.logger.info('Step 1/2: Sending destroy transaction...');
      const tx: ContractTransactionResponse = await (await contract).destroy(tokenId, addressHash);

      // this.logger.info(`Destroy transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      // this.logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);

      // Step 2: Verify destruction via Transfer event (burn)
      // this.logger.info('Step 2/2: Verifying destroy via Transfer event...');
      const burnEvent = await this.parseBurnEvent(receipt, tokenId, addressHash);
      // this.logger.info(
      //   `✓ Membership token #${burnEvent.tokenId} destroyed successfully from ${burnEvent.from}`
      // );

      return {
        tokenId: burnEvent.tokenId,
        from: burnEvent.from,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to destroy membership:', error);

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
   * Set base URI for membership tokens
   * @param contractAddress - Membership contract address
   * @param baseURI - New base URI
   * @returns Transaction hash
   */
  @ensureMembershipDeployed
  async setBaseURI(baseURI: string): Promise<void> {
    // this.logger.info(`Setting base URI for contract ${contractAddress}`);
    await this.ensureNetwork();

    const contract = this.getMembershipContract();
    const contractAddress = this.getMembershipAddress();

    try {
      // this.logger.info('Sending setBaseURI transaction...');
      const tx: ContractTransactionResponse = await (await contract).setBaseURI(baseURI);
      // this.logger.info(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }
      // this.logger.info(`Base URI set successfully. Transaction: ${receipt.hash}`);
      // return receipt.hash;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to set base URI:', error);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract call failed. Please check if you have permission to set the base URI.',
          'CONTRACT_CALL_FAILED',
          { contractAddress, baseURI, originalError: error.message }
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
        `Failed to set base URI: ${error.message || error}`,
        'SET_BASE_URI_ERROR',
        { contractAddress, baseURI, error: error.message || error }
      );
    }
  }

  /**
   * Get all deployed contract addresses
   * @returns Map of contract keys to addresses
   */
  @ensureMembershipDeployed
  getAllDeployedAddresses(): Array<string> {
    return this.deployedContracts;
  }

  /**
   * Get contract address
   * @returns Contract address
   */
  @ensureMembershipDeployed
  getMembershipAddress(): string {
    return this.membershipAddress!;
  }

  /**
   * Get Membership contract instance
   * @param contractAddress - Optional membership contract address. If not provided, uses the stored address.
   * @returns Contract instance
   */
  @ensureMembershipDeployed
  async getMembershipContract(contractAddress?: string): Promise<Contract> {
    const address = contractAddress || this.getMembershipAddress();
    const signer = await getSigner(this.provider as BrowserProvider);
    return createContract(address, MEMBERSHIP_ABI, signer!);
  }

  /**
   * Get contract name
   * @param contractAddress - Membership contract address
   * @returns Contract name
   * @throws {SDKError} If contract doesn't exist or address is invalid
   */
  @ensureMembershipDeployed
  async getName(): Promise<string> {
    const contractAddress = this.getMembershipAddress();

    try {
      const name = await (await this.getMembershipContract()).name();
      return name;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      throw new SDKError(`Failed to get contract name: ${error.message}`, 'CONTRACT_CALL_ERROR', {
        contractAddress,
        error: error.message,
      });
    }
  }

  /**
   * Get contract symbol
   * @param contractAddress - Membership contract address
   * @returns Contract symbol
   * @throws {SDKError} If contract doesn't exist or address is invalid
   */
  @ensureMembershipDeployed
  async getSymbol(): Promise<string> {
    const contractAddress = this.membershipAddress;
    try {
      const symbol = await (await this.getMembershipContract()).symbol();
      return symbol;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      throw new SDKError(`Failed to get contract symbol: ${error.message}`, 'CONTRACT_CALL_ERROR', {
        contractAddress,
        error: error.message,
      });
    }
  }

  /**
   * Get total supply of memberships
   * @param contractAddress - Membership contract address
   * @returns Total supply (0 if no tokens minted yet)
   * @throws {SDKError} If contract doesn't exist or address is invalid
   */
  @ensureMembershipDeployed
  async getTotalSupply(): Promise<bigint> {
    try {
      const supply = await (await this.getMembershipContract()).totalSupply();
      return BigInt(supply);
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      throw new SDKError(`Failed to get total supply: ${error.message}`, 'CONTRACT_CALL_ERROR', {
        contractAddress: this.getMembershipAddress(),
        error: error.message,
      });
    }
  }

  /**
   * Get owner of specific token
   * @param contractAddress - Membership contract address
   * @param tokenId - Token ID
   * @returns Owner address hash (bytes32)
   * @throws {SDKError} If token doesn't exist or contract not found
   */
  @ensureMembershipDeployed
  async getOwnerOf(tokenId: number): Promise<string> {
    if (tokenId === undefined || tokenId === null) {
      throw new SDKError('Token ID is required', 'INVALID_PARAMETER', { tokenId });
    }

    try {
      const owner = await (await this.getMembershipContract()).ownerOf(tokenId);
      return owner;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      throw new SDKError(`Failed to get token owner: ${error.message}`, 'CONTRACT_CALL_ERROR', {
        contractAddress: this.getMembershipAddress(),
        tokenId,
        error: error.message,
      });
    }
  }

  /**
   * Get token URI
   * @param contractAddress - Membership contract address
   * @param tokenId - Token ID
   * @returns Token URI
   * @throws {SDKError} If token doesn't exist or URI not set
   */
  @ensureMembershipDeployed
  async getTokenURI(tokenId: number): Promise<string> {
    if (tokenId === undefined || tokenId === null) {
      throw new SDKError('Token ID is required', 'INVALID_PARAMETER', { tokenId });
    }

    try {
      const uri = await (await this.getMembershipContract()).tokenURI(tokenId);
      return uri;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      throw new SDKError(`Failed to get token URI: ${error.message}`, 'CONTRACT_CALL_ERROR', {
        contractAddress: this.getMembershipAddress(),
        tokenId,
        error: error.message,
      });
    }
  }

  /**
   * Get contract owner
   * @param contractAddress - Membership contract address
   * @returns Owner address
   * @throws {SDKError} If contract doesn't exist
   */
  @ensureMembershipDeployed
  async getOwner(): Promise<string> {
    return this.getMembershipAddress();
  }

  /**
   * Get member snapshot (list of member address hashes)
   * @param contractAddress - Membership contract address
   * @param snapshotId - Snapshot ID
   * @returns Array of member address hashes (empty array if snapshot doesn't exist)
   * @throws {SDKError} If contract doesn't exist or parameters invalid
   */
  @ensureMembershipDeployed
  async getMemberSnapshot(snapshotId: bigint): Promise<string[]> {
    if (snapshotId === undefined || snapshotId === null) {
      throw new SDKError('Snapshot ID is required', 'INVALID_PARAMETER', { snapshotId });
    }

    // this.logger.info(`Getting member snapshot #${snapshotId}`);
    const contract = this.getMembershipContract();
    const contractAddress = this.getMembershipAddress();

    try {
      const members = await (await contract).getMemberSnapshot(snapshotId);
      return members || [];
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error(`Failed to get snapshot #${snapshotId}:`, error.message);

      if (error.code === 'CALL_EXCEPTION') {
        // For snapshots, returning empty array is acceptable
        this.logger.warn(`Snapshot #${snapshotId} does not exist, returning empty array`);
        return [];
      }

      throw new SDKError(`Failed to get member snapshot: ${error.message}`, 'CONTRACT_CALL_ERROR', {
        contractAddress,
        snapshotId,
        error: error.message,
      });
    }
  }

  /**
   * Get latest snapshot ID
   * @param contractAddress - Membership contract address
   * @returns Latest snapshot ID (0 if no snapshots created yet)
   * @throws {SDKError} If contract doesn't exist
   */
  @ensureMembershipDeployed
  async getLatestSnapshotId(): Promise<bigint> {
    const contractAddress = this.getMembershipAddress();

    this.logger.info(`Getting latest snapshot ID for ${contractAddress}`);
    const contract = this.getMembershipContract();

    try {
      const snapshotId = await (await contract).getLatestSnapshotId();
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
   * @param contractAddress - Membership contract address
   * @param snapshotId - Snapshot ID
   * @param addressHash - Member address hash (bytes32)
   * @returns True if member is in snapshot, false otherwise
   * @throws {SDKError} If parameters invalid
   */
  @ensureMembershipDeployed
  async isMemberInSnapshot(snapshotId: bigint, addressHash: string): Promise<boolean> {
    if (snapshotId === undefined || snapshotId === null) {
      throw new SDKError('Snapshot ID is required', 'INVALID_PARAMETER', { snapshotId });
    }

    if (!addressHash || !addressHash.trim()) {
      throw new SDKError('Address hash is required', 'INVALID_PARAMETER', { addressHash });
    }

    // this.logger.info(`Checking if member is in snapshot #${snapshotId}`);
    const contractAddress = this.getMembershipAddress();
    const contract = this.getMembershipContract();

    try {
      const isMember = await (await contract).isMemberInSnapshot(snapshotId, addressHash);
      return isMember;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to check member in snapshot:', error.message);

      if (error.code === 'CALL_EXCEPTION') {
        // For membership check, returning false is acceptable
        return false;
      }

      throw new SDKError(
        `Failed to check member in snapshot: ${error.message}`,
        'CONTRACT_CALL_ERROR',
        { contractAddress, snapshotId, addressHash, error: error.message }
      );
    }
  }
}
