import { Contract, ContractRunner, ContractTransactionResponse, Signer } from 'ethers';
import type {
  DDCMarketConfig,
  MembershipFactoryConfig,
  DeploymentResult,
  NetworkConfig,
  ManagerConfig,
} from '../types';
import { SDKError } from '../types';
import { createContract, validateAddress, ensureCorrectNetwork, Logger } from '../utils';
import { MEMBERSHIP_ABI, MEMBERSHIP_FACTORY_ABI } from '../abi';
import { getDDCConfig } from '../service/api/api';

/**
 * Membership Management API
 * Handles Membership contract deployment and operations
 */
export class MembershipManager {
  static factoryAddress?: string;
  static factoryContract?: Contract;
  static signer?: Signer;

  private networkConfig?: NetworkConfig;
  private logger: Logger;
  public nftAddress?: string;

  // Store deployed contract addresses
  private deployedContracts: Map<string, string> = new Map();

  constructor() {
    // this.runner = config.runner;
    // this.networkConfig = config.network;
    // this.logger = new Logger(config.debug);
    // this.logger.info('Initializing MembershipManager', {
    // hasFactory: !!config.factoryAddress,
    // network: config.network?.name || 'not specified',
    // chainId: config.network?.chainId,
    // });
    // if (config.factoryAddress) {
    //   validateAddress(config.factoryAddress, 'Factory address');
    //   this.factoryAddress = config.factoryAddress;
    //   this.factoryContract = createContract(
    //     config.factoryAddress,
    //     MEMBERSHIP_FACTORY_ABI,
    //     this.runner
    //   );
    //   this.logger.info('Factory contract initialized', { factoryAddress: config.factoryAddress });
    // }
  }

  /**
   * Init Instance of MembershipManager
   * @param config - Configuration object
   * @returns MembershipManager instance
   **/
  static async init(manageConfig: ManagerConfig): Promise<MembershipManager> {
    if (!manageConfig) {
      throw new SDKError('Manager configuration cannot be empty', 'INVALID_PARAMETER', {
        manageConfig,
      });
    }

    const { walletAddress, signer, debug } = manageConfig;
    const result = await getDDCConfig({ address: walletAddress });

    if (result.success) {
      const { nft_factory_address, network } = result.data;

      this.factoryAddress = nft_factory_address;
      this.factoryContract = createContract(nft_factory_address, MEMBERSHIP_FACTORY_ABI, signer);
      // this.networkConfig = network;
      // this.logger = new Logger(config.debug);
      return new MembershipManager();
    }
    throw new SDKError('Failed to get DDC config', 'DDC_CONFIG_ERROR', { result });
  }

  /**
   * Deploy a new Membership contract via factory
   * @param name - Membership contract name
   * @param symbol - Membership contract symbol
   * @returns Deployment result with contract address
   */
  async deployMembership(name: string, symbol: string): Promise<DeploymentResult> {
    if (!name || !name.trim()) {
      throw new SDKError('Contract name cannot be empty', 'INVALID_PARAMETER', { name });
    }

    if (!symbol || !symbol.trim()) {
      throw new SDKError('Contract symbol cannot be empty', 'INVALID_PARAMETER', { symbol });
    }

    if (!this.factoryContract) {
      throw new SDKError(
        'Factory contract not initialized. Please provide factoryAddress in config.',
        'FACTORY_NOT_INITIALIZED'
      );
    }

    this.logger.info('Deploying new Membership contract', { name, symbol });
    await this.ensureNetwork();

    try {
      this.logger.info('Sending deployMembership transaction...');
      const tx: ContractTransactionResponse = await this.factoryContract.deployMembership(
        name,
        symbol
      );

      this.logger.info(`Deploy transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      // Get deployed contract address from return value
      // The factory returns the address directly
      const deployedAddress = await this.factoryContract.deployMembership.staticCall(name, symbol);

      // Store deployed contract address
      const contractKey = `${name}-${symbol}`;
      this.deployedContracts.set(contractKey, deployedAddress);

      this.logger.info(`Membership contract deployed successfully at ${deployedAddress}`);

      return {
        contractAddress: deployedAddress,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to deploy Membership:', error);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract deployment failed. Please check factory contract permissions.',
          'CONTRACT_CALL_FAILED',
          { name, symbol, originalError: error.message }
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

      throw new SDKError(
        `Failed to deploy Membership: ${error.message || error}`,
        'DEPLOYMENT_ERROR',
        { name, symbol, error: error.message || error }
      );
    }
  }

  /**
   * Get deployed contract address by name and symbol
   * @param name - Membership contract name
   * @param symbol - Membership contract symbol
   * @returns Contract address or undefined if not found
   */
  getDeployedAddress(name: string, symbol: string): string | undefined {
    const key = `${name}-${symbol}`;
    return this.deployedContracts.get(key);
  }

  /**
   * Get all deployed contract addresses
   * @returns Map of contract keys to addresses
   */
  getAllDeployedAddresses(): ReadonlyMap<string, string> {
    return this.deployedContracts;
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
      await ensureCorrectNetwork(this.runner, this.networkConfig, this.logger.debug);
    } catch (error) {
      this.logger.error('Network validation failed:', error);
      throw error;
    }
  }

  /**
   * Get Membership contract instance
   * @param contractAddress - Membership contract address
   * @returns Contract instance
   */
  getMembershipContract(contractAddress: string): Contract {
    validateAddress(contractAddress, 'Membership contract address');
    return createContract(contractAddress, MEMBERSHIP_ABI, this.runner);
  }

  // ============================================
  // View Functions (Read-only, with null checks)
  // ============================================

  /**
   * Get contract name
   * @param contractAddress - Membership contract address
   * @returns Contract name
   * @throws {SDKError} If contract doesn't exist or address is invalid
   */
  async name(contractAddress: string): Promise<string> {
    if (!contractAddress || !contractAddress.trim()) {
      this.logger.error('Contract address is required');
      throw new SDKError('Contract address cannot be empty', 'INVALID_ADDRESS', {
        contractAddress,
      });
    }

    this.logger.info(`Getting name for contract ${contractAddress}`);
    const contract = this.getMembershipContract(contractAddress);

    try {
      const name = await contract.name();
      if (!name || name.trim() === '') {
        throw new SDKError('Contract name is empty or not set', 'CONTRACT_NOT_INITIALIZED', {
          contractAddress,
        });
      }
      return name;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to get contract name:', error.message);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract does not exist or is not deployed at this address',
          'CONTRACT_NOT_FOUND',
          { contractAddress }
        );
      }

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
  async symbol(contractAddress: string): Promise<string> {
    if (!contractAddress || !contractAddress.trim()) {
      throw new SDKError('Contract address cannot be empty', 'INVALID_ADDRESS', {
        contractAddress,
      });
    }

    this.logger.info(`Getting symbol for contract ${contractAddress}`);
    const contract = this.getMembershipContract(contractAddress);

    try {
      const symbol = await contract.symbol();
      if (!symbol || symbol.trim() === '') {
        throw new SDKError('Contract symbol is empty or not set', 'CONTRACT_NOT_INITIALIZED', {
          contractAddress,
        });
      }
      return symbol;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to get contract symbol:', error.message);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract does not exist or is not deployed at this address',
          'CONTRACT_NOT_FOUND',
          { contractAddress }
        );
      }

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
  async totalSupply(contractAddress: string): Promise<bigint> {
    if (!contractAddress || !contractAddress.trim()) {
      throw new SDKError('Contract address cannot be empty', 'INVALID_ADDRESS', {
        contractAddress,
      });
    }

    this.logger.info(`Getting total supply for contract ${contractAddress}`);
    const contract = this.getMembershipContract(contractAddress);

    try {
      const supply = await contract.totalSupply();
      return BigInt(supply);
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to get total supply:', error.message);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract does not exist or is not deployed at this address',
          'CONTRACT_NOT_FOUND',
          { contractAddress }
        );
      }

      throw new SDKError(`Failed to get total supply: ${error.message}`, 'CONTRACT_CALL_ERROR', {
        contractAddress,
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
  async ownerOf(contractAddress: string, tokenId: bigint): Promise<string> {
    if (!contractAddress || !contractAddress.trim()) {
      throw new SDKError('Contract address cannot be empty', 'INVALID_ADDRESS', {
        contractAddress,
      });
    }

    if (tokenId === undefined || tokenId === null) {
      throw new SDKError('Token ID is required', 'INVALID_PARAMETER', { tokenId });
    }

    this.logger.info(`Getting owner of token #${tokenId}`);
    const contract = this.getMembershipContract(contractAddress);

    try {
      const owner = await contract.ownerOf(tokenId);
      return owner;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error(`Failed to get owner of token #${tokenId}:`, error.message);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          `Token #${tokenId} does not exist or has not been minted`,
          'TOKEN_NOT_FOUND',
          { contractAddress, tokenId }
        );
      }

      throw new SDKError(`Failed to get token owner: ${error.message}`, 'CONTRACT_CALL_ERROR', {
        contractAddress,
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
  async tokenURI(contractAddress: string, tokenId: bigint): Promise<string> {
    if (!contractAddress || !contractAddress.trim()) {
      throw new SDKError('Contract address cannot be empty', 'INVALID_ADDRESS', {
        contractAddress,
      });
    }

    if (tokenId === undefined || tokenId === null) {
      throw new SDKError('Token ID is required', 'INVALID_PARAMETER', { tokenId });
    }

    this.logger.info(`Getting token URI for token #${tokenId}`);
    const contract = this.getMembershipContract(contractAddress);

    try {
      const uri = await contract.tokenURI(tokenId);
      if (!uri || uri.trim() === '') {
        throw new SDKError(`Token #${tokenId} URI is not set`, 'TOKEN_URI_NOT_SET', {
          contractAddress,
          tokenId,
        });
      }
      return uri;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error(`Failed to get token URI for #${tokenId}:`, error.message);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          `Token #${tokenId} does not exist or has not been minted`,
          'TOKEN_NOT_FOUND',
          { contractAddress, tokenId }
        );
      }

      throw new SDKError(`Failed to get token URI: ${error.message}`, 'CONTRACT_CALL_ERROR', {
        contractAddress,
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
  async getOwner(contractAddress: string): Promise<string> {
    if (!contractAddress || !contractAddress.trim()) {
      throw new SDKError('Contract address cannot be empty', 'INVALID_ADDRESS', {
        contractAddress,
      });
    }

    this.logger.info(`Getting contract owner for ${contractAddress}`);
    const contract = this.getMembershipContract(contractAddress);

    try {
      const owner = await contract.getOwner();
      return owner;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to get contract owner:', error.message);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract does not exist or is not deployed at this address',
          'CONTRACT_NOT_FOUND',
          { contractAddress }
        );
      }

      throw new SDKError(`Failed to get contract owner: ${error.message}`, 'CONTRACT_CALL_ERROR', {
        contractAddress,
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
  async getLatestSnapshotId(contractAddress: string): Promise<bigint> {
    if (!contractAddress || !contractAddress.trim()) {
      throw new SDKError('Contract address cannot be empty', 'INVALID_ADDRESS', {
        contractAddress,
      });
    }

    this.logger.info(`Getting latest snapshot ID for ${contractAddress}`);
    const contract = this.getMembershipContract(contractAddress);

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
   * Get member snapshot (list of member address hashes)
   * @param contractAddress - Membership contract address
   * @param snapshotId - Snapshot ID
   * @returns Array of member address hashes (empty array if snapshot doesn't exist)
   * @throws {SDKError} If contract doesn't exist or parameters invalid
   */
  async getMemberSnapshot(contractAddress: string, snapshotId: bigint): Promise<string[]> {
    if (!contractAddress || !contractAddress.trim()) {
      throw new SDKError('Contract address cannot be empty', 'INVALID_ADDRESS', {
        contractAddress,
      });
    }

    if (snapshotId === undefined || snapshotId === null) {
      throw new SDKError('Snapshot ID is required', 'INVALID_PARAMETER', { snapshotId });
    }

    this.logger.info(`Getting member snapshot #${snapshotId}`);
    const contract = this.getMembershipContract(contractAddress);

    try {
      const members = await contract.getMemberSnapshot(snapshotId);
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
   * Check if member is in snapshot
   * @param contractAddress - Membership contract address
   * @param snapshotId - Snapshot ID
   * @param addressHash - Member address hash (bytes32)
   * @returns True if member is in snapshot, false otherwise
   * @throws {SDKError} If parameters invalid
   */
  async isMemberInSnapshot(
    contractAddress: string,
    snapshotId: bigint,
    addressHash: string
  ): Promise<boolean> {
    if (!contractAddress || !contractAddress.trim()) {
      throw new SDKError('Contract address cannot be empty', 'INVALID_ADDRESS', {
        contractAddress,
      });
    }

    if (snapshotId === undefined || snapshotId === null) {
      throw new SDKError('Snapshot ID is required', 'INVALID_PARAMETER', { snapshotId });
    }

    if (!addressHash || !addressHash.trim()) {
      throw new SDKError('Address hash is required', 'INVALID_PARAMETER', { addressHash });
    }

    this.logger.info(`Checking if member is in snapshot #${snapshotId}`);
    const contract = this.getMembershipContract(contractAddress);

    try {
      const isMember = await contract.isMemberInSnapshot(snapshotId, addressHash);
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

  // ============================================
  // State-Changing Functions (Write operations)
  // ============================================

  /**
   * Set base URI for membership tokens
   * @param contractAddress - Membership contract address
   * @param baseURI - New base URI
   * @returns Transaction hash
   */
  async setBaseURI(contractAddress: string, baseURI: string): Promise<string> {
    this.logger.info(`Setting base URI for contract ${contractAddress}`);
    await this.ensureNetwork();

    const contract = this.getMembershipContract(contractAddress);

    try {
      this.logger.info('Sending setBaseURI transaction...');
      const tx: ContractTransactionResponse = await contract.setBaseURI(baseURI);

      this.logger.info(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      this.logger.info(`Base URI set successfully. Transaction: ${receipt.hash}`);
      return receipt.hash;
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
   * Mint a new membership token
   * @param contractAddress - Membership contract address
   * @param tokenId - Token ID to mint
   * @param addressHash - Member address hash (bytes32)
   * @returns Transaction hash
   */
  async mint(contractAddress: string, tokenId: bigint, addressHash: string): Promise<string> {
    this.logger.info(`Minting membership token #${tokenId}`);
    await this.ensureNetwork();

    const contract = this.getMembershipContract(contractAddress);

    try {
      this.logger.info('Sending mint transaction...');
      const tx: ContractTransactionResponse = await contract.mint(tokenId, addressHash);

      this.logger.info(`Mint transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      this.logger.info(`Membership minted successfully. Transaction: ${receipt.hash}`);
      return receipt.hash;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to mint membership:', error);

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
   * @param contractAddress - Membership contract address
   * @param tokenId - Token ID to destroy
   * @param addressHash - Member address hash (bytes32) for verification
   * @returns Transaction hash
   */
  async destroy(contractAddress: string, tokenId: bigint, addressHash: string): Promise<string> {
    this.logger.info(`Destroying membership token #${tokenId}`);
    await this.ensureNetwork();

    const contract = this.getMembershipContract(contractAddress);

    try {
      this.logger.info('Sending destroy transaction...');
      const tx: ContractTransactionResponse = await contract.destroy(tokenId, addressHash);

      this.logger.info(`Destroy transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      this.logger.info(`Membership destroyed successfully. Transaction: ${receipt.hash}`);
      return receipt.hash;
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
   * Create a new snapshot of current members
   * @param contractAddress - Membership contract address
   * @returns Snapshot ID
   */
  async createSnapshot(contractAddress: string): Promise<bigint> {
    this.logger.info(`Creating snapshot for contract ${contractAddress}`);
    await this.ensureNetwork();

    const contract = this.getMembershipContract(contractAddress);

    try {
      this.logger.info('Sending createSnapshot transaction...');
      const tx: ContractTransactionResponse = await contract.createSnapshot();

      this.logger.info(`Snapshot transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      // Get snapshot ID from return value
      const snapshotId = await contract.getLatestSnapshotId();

      this.logger.info(`Snapshot created successfully. Snapshot ID: ${snapshotId}`);
      return BigInt(snapshotId);
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to create snapshot:', error);

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
   * Transfer ownership of the contract
   * @param contractAddress - Membership contract address
   * @param newOwner - New owner address
   * @returns Transaction hash
   */
  async transferOwnership(contractAddress: string, newOwner: string): Promise<string> {
    this.logger.info(`Transferring ownership to ${newOwner}`);
    await this.ensureNetwork();

    validateAddress(newOwner, 'New owner address');
    const contract = this.getMembershipContract(contractAddress);

    try {
      this.logger.info('Sending transferOwnership transaction...');
      const tx: ContractTransactionResponse = await contract.transferOwnership(newOwner);

      this.logger.info(
        `Transfer ownership transaction sent: ${tx.hash}. Waiting for confirmation...`
      );
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      this.logger.info(`Ownership transferred successfully. Transaction: ${receipt.hash}`);
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
}
