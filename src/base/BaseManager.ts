import {
  Contract,
  ContractTransactionResponse,
  ContractFactory,
  Provider,
  BrowserProvider,
  JsonRpcProvider,
  getAddress,
  Interface,
  ContractTransactionReceipt,
  Signer,
} from 'ethers';
import type {
  DeploymentResult,
  DDCChainConfig,
  ManagerParams,
  ManagerConfig,
  SignerConfig,
} from '../types';
import { SDKError } from '../types';
import { createContract, validateAddress, ensureCorrectNetwork, Logger, getSigner } from '../utils';
import {
  getDDCConfig,
  setContractAddress,
  setFactoryAddress,
  transferContractOwner,
} from '../service/api';
import { addAddress } from '../utils/contract';
import { ensureContractDeployed } from './decorators';

/**
 * Base Manager abstract class
 * Provides common functionality for contract deployment and management
 *
 * @template TContractType - Contract type identifier ('nft' | 'membership')
 */
export abstract class BaseManager<TContractType extends 'nft' | 'membership'> {
  // ==================== Common Properties ====================

  protected provider?: Provider;
  protected signerConfig?: SignerConfig;
  protected logger: Logger;
  protected factoryContract?: Contract;
  protected factoryAddress?: string;
  protected networkConfig?: DDCChainConfig;
  protected deployedContracts: Array<string> = [];
  public metadataUrl?: string;
  protected authToken?: string; // auth jwt token for DDCNFTManager
  protected authExpiresAt?: string; // auth jwt token expires at for DDCNFTManager

  protected readonly BYTES32_ZERO =
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  /** Current active contract address */
  protected contractAddress?: string;

  // ==================== Abstract Properties (subclasses must implement) ====================

  /** Contract ABI */
  protected abstract readonly CONTRACT_ABI: any;

  /** Factory contract ABI */
  protected abstract readonly FACTORY_ABI: any;

  /** Factory contract bytecode JSON */
  protected abstract readonly FACTORY_JSON: any;

  /** Contract type ('nft' | 'membership') */
  protected abstract readonly CONTRACT_TYPE: TContractType;

  // ==================== Constructor ====================

  constructor(config: ManagerConfig) {
    this.logger = new Logger(config?.debug || false);
    if (config?.provider && config?.network) {
      const { provider, network, signerConfig } = config;
      this.provider = provider;
      this.signerConfig = signerConfig;
      this.networkConfig = network;

      this.logger.info(`Initializing ${this.getManagerName()}`, {
        hasFactory: !!config.factoryAddress,
        network: network.chain_name || 'not specified',
        chain_id: network.chain_id,
        providerType: provider.constructor.name,
      });
    }
  }

  // ==================== Abstract Methods (subclasses must implement) ====================

  /**
   * Get manager name (for logging)
   */
  protected abstract getManagerName(): string;

  /**
   * Parse deployment event to extract contract address
   */
  protected abstract parseDeploymentEvent(
    receipt: any,
    expectedName: string,
    expectedSymbol: string
  ): string;

  // ==================== Concrete Methods (common implementations) ====================

  /**
   * Get current contract address
   */
  public getContractAddress(): string | undefined {
    return this.contractAddress;
  }

  /**
   * Set current contract address
   */
  public setContractAddress(address: string): void {
    this.contractAddress = address;
  }

  /**
   * Get current signer instance
   */
  protected async getSigner(): Promise<Signer> {
    if (!this.provider) {
      throw new SDKError('Provider is not available', 'PROVIDER_NOT_AVAILABLE');
    }
    return await getSigner(this.provider, this.signerConfig);
  }

  // ==================== Common Public Methods ====================

  /**
   * Ensure connected to correct network
   * @protected
   */
  protected async ensureNetwork(): Promise<void> {
    if (!this.networkConfig) {
      this.logger.warn('No network config provided, skipping network validation');
      return;
    }

    if (!this.provider) {
      this.logger.warn('No provider available, skipping network validation');
      return;
    }

    try {
      // For BrowserProvider, use ensureCorrectNetwork which can switch chains
      if (this.provider instanceof BrowserProvider) {
        await ensureCorrectNetwork(this.provider, this.networkConfig, this.logger.debug);
      } else if (this.provider instanceof JsonRpcProvider) {
        // JsonRpcProvider is constructed by SDK via resolveProvider -> createJsonRpcProvider
        // with chainId from networkConfig.chain_id and staticNetwork: true
        // Since chainId comes from networkConfig (trusted source used to construct the provider),
        // we trust it directly - no need to validate
        this.logger.info(
          `JsonRpcProvider network trusted: chainId ${this.networkConfig.chain_id} (SDK constructed)`
        );
      } else {
        // For other provider types, try to validate network
        try {
          const network = await this.provider.getNetwork();
          const expectedChainId = BigInt(this.networkConfig.chain_id);
          if (network.chainId !== expectedChainId) {
            this.logger.warn(
              `Network mismatch: Connected to chain ${network.chainId}, expected ${expectedChainId}`
            );
          } else {
            this.logger.info(`Network validated: chainId ${network.chainId}`);
          }
        } catch (networkError) {
          // If getNetwork() fails, log warning but continue
          this.logger.warn(
            `Could not validate network via getNetwork(), continuing with networkConfig chainId ${this.networkConfig.chain_id}`,
            networkError
          );
        }
      }
    } catch (error) {
      this.logger.error('Network validation failed:', error);
      throw error;
    }
  }

  /**
   * Get all deployed contract addresses
   */
  public getAllDeployedAddresses(): ReadonlyArray<string> {
    return this.deployedContracts;
  }

  /**
   * Get network config
   */
  public getNetworkConfig(): DDCChainConfig {
    if (!this.networkConfig) {
      throw new SDKError('Network config not available', 'NETWORK_CONFIG_NOT_AVAILABLE');
    }
    return this.networkConfig;
  }

  /**
   * Get factory contract address
   */
  public getFactoryAddress(): string {
    return this.factoryAddress || '';
  }

  /**
   * Get default metadata URL
   */
  public getDefaultMetadataURL(): string {
    if (!this.metadataUrl) {
      throw new SDKError('Metadata URL not available', 'METADATA_URL_NOT_AVAILABLE');
    }
    return this.metadataUrl;
  }

  // ==================== Factory Deployment (Template Method) ====================

  /**
   * Deploy factory contract
   */
  public async deployFactory(): Promise<DeploymentResult> {
    if (!this.provider) {
      throw new SDKError('provider is required for factory deployment', 'MISSING_SIGNER');
    }

    await this.ensureNetwork();

    try {
      const bytecode = this.FACTORY_JSON.bytecode.object;

      if (!bytecode) {
        throw new SDKError('Factory bytecode not found in ABI', 'MISSING_BYTECODE');
      }

      const signer = await getSigner(this.provider!, this.signerConfig);
      const factory = new ContractFactory(this.FACTORY_ABI, bytecode, signer);

      this.logger.info(`Deploying ${this.getManagerName()} Factory contract...`);
      const contract = await factory.deploy();
      await contract.waitForDeployment();

      // Get deployment transaction
      const deploymentTx = contract.deploymentTransaction();
      if (!deploymentTx) {
        throw new SDKError('Deployment transaction not available', 'DEPLOYMENT_TX_ERROR');
      }

      // Wait for transaction receipt (most reliable source for contract address)
      const receipt = await deploymentTx.wait();
      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      // Get contract address from receipt (most reliable)
      let factoryAddress = receipt.contractAddress;
      if (!factoryAddress) {
        // Fallback to contract.getAddress() if receipt doesn't have it
        factoryAddress = await contract.getAddress();
        this.logger.warn('Contract address not found in receipt, using contract.getAddress()');
      }

      // Normalize address to checksum format for consistency
      factoryAddress = getAddress(factoryAddress);

      // Store factory address and create factory contract instance
      this.factoryAddress = factoryAddress;
      this.factoryContract = createContract(factoryAddress, this.FACTORY_ABI, signer);

      // Report factory address to backend
      await setFactoryAddress({
        address: await signer.getAddress(),
        factoryAddress: factoryAddress,
        type: this.CONTRACT_TYPE,
      });

      return {
        contractAddress: factoryAddress,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      return this.handleDeploymentError(error, 'Factory');
    }
  }

  /**
   * Deploy contract (via factory)
   */
  public async deployContract(name: string, symbol: string): Promise<DeploymentResult> {
    if (!name || !name.trim()) {
      throw new SDKError('Contract name cannot be empty', 'INVALID_PARAMETER', { name });
    }

    if (!symbol || !symbol.trim()) {
      throw new SDKError('Contract symbol cannot be empty', 'INVALID_PARAMETER', { symbol });
    }

    await this.ensureNetwork();

    try {
      const tx: ContractTransactionResponse = await this.factoryContract![
        this.getDeployMethodName()
      ](name, symbol);

      const receipt: ContractTransactionReceipt | null = await tx.wait();
      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      let deployedAddress = this.parseDeploymentEvent(receipt, name, symbol);

      if (!deployedAddress) {
        throw new SDKError(
          'Failed to parse deployment event from transaction receipt.',
          'EVENT_PARSE_ERROR',
          {
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            name,
            symbol,
          }
        );
      }

      deployedAddress = getAddress(deployedAddress);
      addAddress(this.deployedContracts, deployedAddress);

      if (!this.provider) {
        throw new SDKError('Provider is not available', 'PROVIDER_NOT_AVAILABLE');
      }
      const signer = await getSigner(this.provider, this.signerConfig);
      const address = await signer.getAddress();

      await setContractAddress({
        address: address,
        contract: deployedAddress,
        type: this.CONTRACT_TYPE,
      });

      this.setContractAddress(deployedAddress);

      return {
        contractAddress: deployedAddress,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      if (error instanceof SDKError) throw error;
      return this.handleDeploymentError(error, 'Contract', { name, symbol });
    }
  }

  /**
   * Get deploy method name (can be overridden by subclasses)
   */
  protected getDeployMethodName(): string {
    const typeName = this.CONTRACT_TYPE === 'nft' ? 'DDCNFT' : 'Membership';
    return `deploy${typeName}`;
  }

  // ==================== Contract Operations ====================

  /**
   * Get contract instance
   */
  public async getContract(contractAddress?: string): Promise<Contract> {
    const address = contractAddress || this.getContractAddress();

    if (!address) {
      throw new SDKError(
        `No contract address available. Please deploy a contract first or provide an address.`,
        'NO_CONTRACT_ADDRESS'
      );
    }

    validateAddress(address, `${this.getManagerName()} contract address`);
    if (!this.provider) {
      throw new SDKError('Provider is not available', 'PROVIDER_NOT_AVAILABLE');
    }
    const signer = await getSigner(this.provider, this.signerConfig);
    return createContract(address, this.CONTRACT_ABI, signer);
  }

  /**
   * Transfer contract ownership to new owner address
   */
  @ensureContractDeployed
  public async transferOwnership(newOwner: string): Promise<string> {
    const contract = await this.getContract();

    try {
      const tx: ContractTransactionResponse = await contract.transferOwnership(newOwner);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      // set contract owner to new owner
      if (!this.provider) {
        throw new SDKError('Provider is not available', 'PROVIDER_NOT_AVAILABLE');
      }
      const signer = await getSigner(this.provider, this.signerConfig);
      await transferContractOwner({
        address: await signer.getAddress(),
        contract: this.getContractAddress()!,
        type: this.CONTRACT_TYPE,
        ownerAddress: newOwner,
      });

      return receipt.hash;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to transfer ownership:', error);
      throw new SDKError('Failed to transfer ownership', 'TRANSFER_OWNERSHIP_ERROR', {
        error: error.message,
      });
    }
  }

  /**
   * Set base URI
   */
  @ensureContractDeployed
  public async setBaseURI(baseURI: string): Promise<void> {
    await this.ensureNetwork();
    const contract = await this.getContract();

    try {
      const tx: ContractTransactionResponse = await contract.setBaseURI(baseURI);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to set base URI:', error);
      throw this.handleContractError(error, 'SET_BASE_URI_ERROR', { baseURI });
    }
  }

  // ==================== Contract Read Methods ====================

  /**
   * Get contract name
   */
  @ensureContractDeployed
  public async getName(): Promise<string> {
    const contract = await this.getContract();

    try {
      return await contract.name();
    } catch (error) {
      if (error instanceof SDKError) throw error;
      throw new SDKError(`Failed to get contract name: ${error}`, 'GET_NAME_ERROR', { error });
    }
  }

  /**
   * Get contract symbol
   */
  @ensureContractDeployed
  public async getSymbol(): Promise<string> {
    const contract = await this.getContract();

    try {
      return await contract.symbol();
    } catch (error) {
      if (error instanceof SDKError) throw error;
      throw new SDKError(`Failed to get contract symbol: ${error}`, 'GET_SYMBOL_ERROR', {
        error,
      });
    }
  }

  /**
   * Get contract owner
   */
  @ensureContractDeployed
  public async getOwner(): Promise<string> {
    const contract = await this.getContract();

    try {
      return await contract.owner();
    } catch (error) {
      if (error instanceof SDKError) throw error;
      throw new SDKError(`Failed to get contract owner: ${error}`, 'GET_OWNER_ERROR', { error });
    }
  }

  /**
   * Get token owner
   */
  @ensureContractDeployed
  public async getOwnerOf(tokenId: bigint): Promise<string> {
    const contract = await this.getContract();

    try {
      return await contract.ownerOf(tokenId);
    } catch (error) {
      if (error instanceof SDKError) throw error;
      throw new SDKError(`Failed to get owner of token: ${error}`, 'GET_OWNER_OF_ERROR', {
        tokenId,
        error,
      });
    }
  }

  /**
   * Get token URI
   */
  @ensureContractDeployed
  public async getTokenURI(tokenId: bigint): Promise<string> {
    const contract = await this.getContract();

    try {
      return await contract.tokenURI(tokenId);
    } catch (error) {
      if (error instanceof SDKError) throw error;
      throw new SDKError(`Failed to get token URI: ${error}`, 'GET_TOKEN_URI_ERROR', {
        tokenId,
        error,
      });
    }
  }

  // ==================== Error Handling Helpers ====================

  /**
   * Handle deployment error
   */
  protected handleDeploymentError(error: any, context: string, extra?: any): never {
    this.logger.error(`${context} deployment failed:`, error);

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

    if (error.code === 'CALL_EXCEPTION') {
      throw new SDKError(
        `Contract call failed. The deployment might be rejected (duplicate name/symbol, or permission issue).`,
        'CONTRACT_CALL_FAILED',
        { ...extra, reason: error.reason, originalError: error.message }
      );
    }

    if (error.code === 'NONCE_EXPIRED') {
      throw new SDKError('Transaction nonce expired. Please try again.', 'NONCE_EXPIRED', {
        error: error.message,
      });
    }

    throw new SDKError(
      `Failed to deploy ${context}: ${error.message || error}`,
      'DEPLOYMENT_ERROR',
      { ...extra, error: error.message || error }
    );
  }

  /**
   * Handle contract call error
   */
  protected handleContractError(error: any, errorCode: string, extra?: any): never {
    if (error.code === 'CALL_EXCEPTION') {
      throw new SDKError(
        'Contract call failed. Please check if you have the required permissions.',
        'CONTRACT_CALL_FAILED',
        { ...extra, originalError: error.message }
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

    throw new SDKError(`Operation failed: ${error.message || error}`, errorCode, {
      ...extra,
      error: error.message || error,
    });
  }

  /**
   * Parse generic Transfer event
   */
  protected async parseTransferEventGeneric(
    receipt: any,
    expectedTokenId: bigint,
    expectedFrom?: string,
    expectedTo?: string
  ): Promise<{ from: string; to: string; tokenId: bigint }> {
    try {
      const contractInterface = new Interface(this.CONTRACT_ABI);

      for (const log of receipt.logs) {
        try {
          const parsed = contractInterface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });

          if (parsed && parsed.name === 'Transfer') {
            const { from, to, tokenId } = parsed.args;
            const tokenIdBigInt = BigInt(tokenId);

            if (tokenIdBigInt !== expectedTokenId) {
              throw new SDKError(
                `TokenId (${tokenIdBigInt}) does not match expected tokenId (${expectedTokenId})`,
                'TOKEN_ID_MISMATCH',
                { expected: expectedTokenId, actual: tokenIdBigInt }
              );
            }

            if (expectedFrom && from.toLowerCase() !== expectedFrom.toLowerCase()) {
              throw new SDKError(
                `From address (${from}) does not match expected (${expectedFrom})`,
                'FROM_MISMATCH',
                { expected: expectedFrom, actual: from }
              );
            }

            if (expectedTo && to.toLowerCase() !== expectedTo.toLowerCase()) {
              throw new SDKError(
                `To address (${to}) does not match expected (${expectedTo})`,
                'TO_MISMATCH',
                { expected: expectedTo, actual: to }
              );
            }

            return { from, to, tokenId: tokenIdBigInt };
          }
        } catch (error) {
          if (error instanceof SDKError) throw error;
          continue;
        }
      }
    } catch (error) {
      if (error instanceof SDKError) throw error;
      this.logger.error('Error parsing Transfer event:', error);
    }

    throw new SDKError(
      'Transfer event not found in transaction receipt.',
      'TRANSFER_EVENT_NOT_FOUND',
      { txHash: receipt.hash, expectedTokenId }
    );
  }
}
