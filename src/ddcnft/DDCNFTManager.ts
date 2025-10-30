import { Contract, ContractTransactionResponse, ContractFactory, Provider, BrowserProvider, getAddress, Interface } from 'ethers';
import type { DeploymentResult, DDCChainConfig, ManagerParams, ManagerConfig } from '../types';
import { SDKError } from '../types';
import { createContract, validateAddress, ensureCorrectNetwork, Logger, getSigner } from '../utils';
import { DDCNFT_ABI, DDCNFT_FACTORY_ABI } from '../abi';
import { getDDCConfig, setContractAddress, setFactoryAddress } from '../service/api';
import { ensureFactoryDeployed, ensureDDCNFTDeployed, addAddress } from '../utils/contract';
import DDCNFTFactoryJson from '../abi/DDCNFTFactory.json';

/**
 * DDCNFT Management API
 * Handles DDCNFT contract deployment and operations
 */
export class DDCNFTManager {
  // bytes32 zero value (64 hex characters = 32 bytes) - used for mint/burn verification
  private static readonly BYTES32_ZERO =
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  private provider?: Provider;
  private factoryContract?: Contract; // factory instance
  private logger: Logger;
  private static instance: DDCNFTManager | null = null;
  
  public factoryAddress?: string; 
  public networkConfig?: DDCChainConfig;
  public ddcnftAddress?: string; // current deployed DDCNFT contract address

  // All deployed nft contract addresses
  private deployedContracts: Array<string> = [];

  constructor(config: ManagerConfig) {
    this.logger = new Logger(config?.debug || false);
    if (config?.provider && config?.network) {
      const { provider, network } = config;
      this.provider = provider;
      this.networkConfig = network;

      this.logger.info('Initializing DDCNFTManager', {
        network: network.chain_name || 'not specified',
        chain_id: network.chain_id,
      });
    }
  }

  /**
   * Parse deployed contract address from DDCNFTDeployed event
   * @private
   * @returns Contract address from event, or empty string if event not found
   */
  private parseDeploymentEvent(receipt: any, expectedName: string, expectedSymbol: string): string {
    try {
      // Create a fresh Interface instance to avoid ethers.js v6 internal class check issues
      // Using contract.interface directly can cause "Receiver must be an instance of class _Interface" error
      const factoryInterface = new Interface(DDCNFT_FACTORY_ABI);

      for (const log of receipt.logs) {
        try {
          const parsed = factoryInterface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });

          if (parsed && parsed.name === 'DDCNFTDeployed') {
            const { contractAddress, name, symbol } = parsed.args;

            if (name === expectedName && symbol === expectedSymbol) {
              this.logger.info(`Found DDCNFTDeployed event: ${contractAddress}`);
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
   * Parse Transfer event to verify minting
   * @private
   * @param receipt - Transaction receipt
   * @param expectedTokenId - Expected token ID that should be minted
   * @returns Parsed transfer information
   * @throws SDKError if event not found or parameters don't match
   */
  private async parseTransferEvent(
    receipt: any,
    expectedTokenId: bigint
  ): Promise<{ fromHash: string; toHash: string; tokenId: bigint }> {
    try {
      // Create a fresh Interface instance to avoid ethers.js v6 internal class check issues
      const nftInterface = new Interface(DDCNFT_ABI);

      for (const log of receipt.logs) {
        try {
          const parsed = nftInterface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });

          if (parsed && parsed.name === 'Transfer') {
            const { fromHash, toHash, tokenId } = parsed.args;
            const tokenIdBigInt = BigInt(tokenId);

            // this.logger.info(
            //   `Found Transfer event: fromHash=${fromHash}, toHash=${toHash}, tokenId=${tokenIdBigInt}`
            // );

            // Verify the event matches expected parameters
            // For minting, 'fromHash' should be bytes32 zero value
            const isZeroHash = fromHash.toLowerCase() === DDCNFTManager.BYTES32_ZERO.toLowerCase();

            if (!isZeroHash) {
              this.logger.warn(
                `Transfer event 'fromHash' is not bytes32 zero value, this may not be a mint operation. Got: ${fromHash}`
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

            return {
              fromHash,
              toHash,
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
      { txHash: receipt.hash, expectedTokenId }
    );
  }

  /**
   * Parse Transfer event to verify transfer operation
   * @private
   * @param receipt - Transaction receipt
   * @param expectedTokenId - Expected token ID that should be transferred
   * @param expectedToHash - Expected recipient address hash
   * @returns Parsed transfer information
   * @throws SDKError if event not found or parameters don't match
   */
  private async parseTransferEventForTransfer(
    receipt: any,
    expectedTokenId: bigint,
    expectedToHash: string
  ): Promise<{ fromHash: string; toHash: string; tokenId: bigint }> {
    try {
      // Create a fresh Interface instance to avoid ethers.js v6 internal class check issues
      const nftInterface = new Interface(DDCNFT_ABI);

      for (const log of receipt.logs) {
        try {
          const parsed = nftInterface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });

          if (parsed && parsed.name === 'Transfer') {
            const { fromHash, toHash, tokenId } = parsed.args;
            const tokenIdBigInt = BigInt(tokenId);

            // this.logger.info(
            //   `Found Transfer event: fromHash=${fromHash}, toHash=${toHash}, tokenId=${tokenIdBigInt}`
            // );

            // Verify tokenId matches
            if (tokenIdBigInt !== expectedTokenId) {
              throw new SDKError(
                `Transferred tokenId (${tokenIdBigInt}) does not match expected tokenId (${expectedTokenId})`,
                'TOKEN_ID_MISMATCH',
                { expected: expectedTokenId, actual: tokenIdBigInt }
              );
            }

            // Verify recipient hash matches
            if (toHash.toLowerCase() !== expectedToHash.toLowerCase()) {
              throw new SDKError(
                `Transferred to address hash (${toHash}) does not match expected hash (${expectedToHash})`,
                'RECIPIENT_MISMATCH',
                { expected: expectedToHash, actual: toHash }
              );
            }

            return {
              fromHash,
              toHash,
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
      'Transfer event not found in transaction receipt. The token may have been transferred but could not be verified.',
      'TRANSFER_EVENT_NOT_FOUND',
      { txHash: receipt.hash, expectedTokenId, expectedToHash }
    );
  }

  /**
   * Parse Transfer event to verify destroy/burn operation
   * Note: For destroy operations, fromHash is the keyHash (not owner address hash)
   * @private
   * @param receipt - Transaction receipt
   * @param expectedTokenId - Expected token ID that should be destroyed
   * @returns Parsed burn information with keyHash, zero toHash, and tokenId
   * @throws SDKError if event not found or parameters don't match
   */
  private async parseTransferEventForDestroy(
    receipt: any,
    expectedTokenId: bigint
  ): Promise<{ fromHash: string; toHash: string; tokenId: bigint }> {
    try {
      // Create a fresh Interface instance to avoid ethers.js v6 internal class check issues
      const nftInterface = new Interface(DDCNFT_ABI);

      for (const log of receipt.logs) {
        try {
          const parsed = nftInterface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });

          if (parsed && parsed.name === 'Transfer') {
            const { fromHash, toHash, tokenId } = parsed.args;
            const tokenIdBigInt = BigInt(tokenId);

            // this.logger.info(
            //   `Found Transfer event: fromHash(keyHash)=${fromHash}, toHash=${toHash}, tokenId=${tokenIdBigInt}`
            // );

            // Verify the event matches expected parameters
            // For destroying/burning, 'toHash' should be bytes32 zero value
            const isZeroHash = toHash.toLowerCase() === DDCNFTManager.BYTES32_ZERO.toLowerCase();

            if (!isZeroHash) {
              this.logger.warn(
                `Transfer event 'toHash' is not bytes32 zero value, this may not be a destroy operation. Got: ${toHash}`
              );
            }

            // Verify tokenId matches
            if (tokenIdBigInt !== expectedTokenId) {
              throw new SDKError(
                `Destroyed tokenId (${tokenIdBigInt}) does not match expected tokenId (${expectedTokenId})`,
                'TOKEN_ID_MISMATCH',
                { expected: expectedTokenId, actual: tokenIdBigInt }
              );
            }

            return {
              fromHash,
              toHash,
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
      this.logger.error('Error parsing Transfer event for destroy:', error);
    }

    // If we reach here, event was not found
    throw new SDKError(
      'Transfer event not found in transaction receipt. The token may have been destroyed but could not be verified.',
      'TRANSFER_EVENT_NOT_FOUND',
      { txHash: receipt.hash, expectedTokenId }
    );
  }

  /**
   * Parse TokenDestroyed event to verify destroy operation
   * Note: ownerHash is actually the keyHash (keccak256 hash of the destroy key)
   * @private
   * @param receipt - Transaction receipt
   * @param expectedTokenId - Expected token ID that should be destroyed
   * @returns Parsed destroy information with tokenId and keyHash (named ownerHash in event)
   * @throws SDKError if event not found or parameters don't match
   */
  private async parseTokenDestroyedEvent(
    receipt: any,
    expectedTokenId: bigint
  ): Promise<{ tokenId: bigint; ownerHash: string }> {
    try {
      // Create a fresh Interface instance to avoid ethers.js v6 internal class check issues
      const nftInterface = new Interface(DDCNFT_ABI);

      for (const log of receipt.logs) {
        try {
          const parsed = nftInterface.parseLog({
            topics: [...log.topics],
            data: log.data,
          });

          if (parsed && parsed.name === 'TokenDestroyed') {
            const { tokenId, ownerHash } = parsed.args;
            const tokenIdBigInt = BigInt(tokenId);

            // this.logger.info(
            //   `Found TokenDestroyed event: tokenId=${tokenIdBigInt}, ownerHash(keyHash)=${ownerHash}`
            // );

            // Verify tokenId matches
            if (tokenIdBigInt !== expectedTokenId) {
              throw new SDKError(
                `Destroyed tokenId (${tokenIdBigInt}) does not match expected tokenId (${expectedTokenId})`,
                'TOKEN_ID_MISMATCH',
                { expected: expectedTokenId, actual: tokenIdBigInt }
              );
            }

            return {
              tokenId: tokenIdBigInt,
              ownerHash,
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
      this.logger.error('Error parsing TokenDestroyed event:', error);
    }

    // If we reach here, event was not found
    throw new SDKError(
      'TokenDestroyed event not found in transaction receipt. The token may have been destroyed but could not be verified.',
      'TOKEN_DESTROYED_EVENT_NOT_FOUND',
      { txHash: receipt.hash, expectedTokenId }
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
   * Init Instance of DDCNFTManager
   * @param config - Configuration object
   * @returns DDCNFTManager instance
   **/
  static async init(manageConfig: ManagerParams): Promise<DDCNFTManager> {
    if (!manageConfig) {
      throw new SDKError('Manager configuration cannot be empty', 'INVALID_PARAMETER', {
        manageConfig,
      });
    }

    const { walletAddress, provider, debug } = manageConfig;
    // query ddc config from api
    const result = await getDDCConfig({ address: walletAddress });

    if (result.success) {
      const { nft_factory_address, network } = result.data.data;
      const config: ManagerConfig = {
        provider,
        debug: debug || false,
        network: network,
        factoryAddress: nft_factory_address,
      };
      
      // Create instance
      this.instance = new DDCNFTManager(config);
      
      // Validate network immediately after initialization
      // This ensures the wallet is connected to the correct network before any operations
      await this.instance.ensureNetwork();

            
      if (config.factoryAddress) {
        this.instance.factoryAddress = config.factoryAddress;
        const signer = await getSigner(provider as BrowserProvider);
        this.instance.factoryContract = createContract(config.factoryAddress, DDCNFT_FACTORY_ABI, signer);
      }
      
      return this.instance;
    }
    throw new SDKError('Failed to get DDC config', 'DDC_CONFIG_ERROR', { result });
  }

  /**
   * Deploy DDCNFTFactory contract
   * Users must deploy the factory contract before deploying DDCNFT contracts
   *
   * @returns Deployment result with factory contract address
   * @throws {SDKError} If deployment fails or user rejects transaction
   */
  async deployDDCFactory(): Promise<DeploymentResult> {
    if (!this.provider) {
      throw new SDKError('provider is required for factory deployment', 'MISSING_SIGNER');
    }

    await this.ensureNetwork();

    try {
      // Create contract factory using bytecode from ABI
      const bytecode = DDCNFTFactoryJson.bytecode.object;
      const signer = await getSigner(this.provider as BrowserProvider);
      const factory = new ContractFactory(DDCNFT_FACTORY_ABI, bytecode, signer);

      // Deploy the contract
      this.logger.info('Deploying DDCNFTFactory contract...');
      // this.logger.info('Sending factory deployment transaction...');
      const contract = await factory.deploy();
      // this.logger.info(`Factory deployment transaction sent: ${contract.deploymentTransaction()?.hash}`);

      // Wait for deployment to complete
      await contract.waitForDeployment();

      const factoryAddress = await contract.getAddress();
      // this.logger.info(`DDCNFTFactory deployed successfully at ${factoryAddress}`);

      // Store the factory address and create factory contract instance
      this.factoryAddress = factoryAddress;
      this.factoryContract = createContract(factoryAddress, DDCNFT_FACTORY_ABI, signer);
      const deploymentTx = contract.deploymentTransaction();
      await setFactoryAddress({ address: await signer!.getAddress()!, factoryAddress: factoryAddress, type: 'nft' });


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
        `Failed to deploy DDCNFTFactory: ${error.message || error}`,
        'FACTORY_DEPLOYMENT_ERROR',
        { error: error.message || error }
      );
    }
  }

  /**
   * Deploy a new DDCNFT contract via factory
   *
   * Implementation strategy:
   * 1. Ensure factory contract is deployed and set (via @ensureFactoryDeployed decorator)
   * 2. Execute the deployment transaction via factory contract
   * 3. Parse DDCNFTDeployed event from transaction receipt to get actual deployed address
   * 4. Normalize address to checksum format for consistency
   *
   * Note: We prioritize event-based address retrieval over staticCall because:
   * - Event address is emitted by the actual contract deployment, guaranteed to be correct
   * - staticCall can be unreliable with CREATE opcode (nonce changes between simulation and execution)
   * - This approach is more robust for production use
   *
   * @param name - NFT collection name
   * @param symbol - NFT collection symbol
   * @returns Deployment result with contract address
   * @throws {SDKError} If factory contract is not deployed or event parsing fails
   */
  @ensureFactoryDeployed
  async deployDDCNFT(name: string, symbol: string): Promise<DeploymentResult> {
    if (!name || !name.trim()) {
      throw new SDKError('Contract name cannot be empty', 'INVALID_PARAMETER', { name });
    }

    if (!symbol || !symbol.trim()) {
      throw new SDKError('Contract symbol cannot be empty', 'INVALID_PARAMETER', { symbol });
    }

    // this.logger.info('Deploying new DDCNFT contract', { name, symbol });
    await this.ensureNetwork();

    try {
      // Execute deployment transaction via factory
      // this.logger.info('Sending deployment transaction to blockchain...');
      const tx: ContractTransactionResponse = await this.factoryContract!.deployDDCNFT(
        name,
        symbol
      );

      // this.logger.info(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      // this.logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);

      // Parse deployment address from DDCNFTDeployed event (most reliable source)
      let deployedAddress = this.parseDeploymentEvent(receipt, name, symbol);

      if (!deployedAddress) {
        throw new SDKError(
          'Failed to parse DDCNFTDeployed event from transaction receipt.',
          'EVENT_PARSE_ERROR',
          { 
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            name,
            symbol
          }
        );
      }

      // Normalize address to checksum format for consistency
      deployedAddress = getAddress(deployedAddress);
      // this.logger.info(`✓ DDCNFT contract deployed successfully at ${deployedAddress}`);

      // Store deployed contract address
      this.deployedContracts = addAddress(this.deployedContracts, deployedAddress);
      await setContractAddress({ address: deployedAddress, contract: deployedAddress, type: 'nft' });
      this.ddcnftAddress = deployedAddress;

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
        `Failed to deploy DDCNFT contract: ${error.message || error}`,
        'DEPLOYMENT_ERROR',
        { name, symbol, error: error.message || error }
      );
    }
  }

  /**
   * transfer ownership of the DDCNFT contract
   * @param newOwner - New owner address
   * @returns Deployment result
   */
  async transferOwnership(newOwner: string): Promise<string> {
    const contract = await this.getDDCNFTContract();
    try {
      const tx: ContractTransactionResponse = await contract.transferOwnership(newOwner);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }
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
   * pause the DDCNFT contract
   * @returns Transaction hash
   */
  async pause(): Promise<string> {
    const contract = await this.getDDCNFTContract();

    try {
      const tx: ContractTransactionResponse = await contract.pause();
      const receipt = await tx.wait();
      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }
      return receipt.hash;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;
      this.logger.error('Failed to pause:', error);
      throw new SDKError('Failed to pause', 'PAUSE_ERROR', { error: error.message });
    }
  }

  /**
   * unpause the DDCNFT contract
   * @returns Transaction hash
   */
  async unpause(): Promise<string> {
    const contract = await this.getDDCNFTContract();
    try {
      const tx: ContractTransactionResponse = await contract.unpause();
      const receipt = await tx.wait();
      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }
      return receipt.hash;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;
      this.logger.error('Failed to unpause:', error);
      throw new SDKError('Failed to unpause', 'UNPAUSE_ERROR', { error: error.message });
    }
  }

  /**
   * Get the current active DDCNFT contract address
   * @returns Current DDCNFT contract address or undefined
   */
  getDDCNFTAddress(): string | undefined {
    return this.ddcnftAddress;
  }

  /**
   * Get all deployed contract addresses
   * @returns Array of deployed contract addresses
   */
  getAllDeployedAddresses(): ReadonlyArray<string> {
    return this.deployedContracts;
  }

  /**
   * Get DDCNFT contract instance
   * @param contractAddress - DDCNFT contract address (optional, uses stored address if not provided)
   * @returns Contract instance
   */
  async getDDCNFTContract(contractAddress?: string): Promise<Contract> {
    const address = contractAddress || this.ddcnftAddress;
    if (!address) {
      throw new SDKError(
        'No DDCNFT contract address available. Please deploy a contract first or provide an address.',
        'NO_CONTRACT_ADDRESS'
      );
    }
    validateAddress(address, 'DDCNFT contract address');
    const signer = await getSigner(this.provider as BrowserProvider);
    return createContract(address, DDCNFT_ABI, signer!);
  }

  /**
   * Set base URI for DDCNFT contract
   * @param baseURI - New base URI
   * @returns Transaction hash
   */
  @ensureDDCNFTDeployed
  async setBaseURI(baseURI: string): Promise<void> {
    // this.logger.info(`Setting base URI`);

    // Ensure correct network before transaction
    await this.ensureNetwork();

    const contract = await this.getDDCNFTContract();

    try {
      // this.logger.info('Sending setBaseURI transaction...');
      const tx: ContractTransactionResponse = await contract.setBaseURI(baseURI);

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

      // Enhanced error messages for common issues
      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract call failed. Please check if you have permission to set the base URI.',
          'CONTRACT_CALL_FAILED',
          { baseURI, originalError: error.message }
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
        `Failed to set base URI: ${error.message || error}`,
        'SET_BASE_URI_ERROR',
        { baseURI, error: error.message || error }
      );
    }
  }

  /**
   * Mint NFT token
   * Note: NFT will be minted to the contract owner (caller of this function)
   *
   * @example
   * ```typescript
   * import { ethers } from 'ethers';
   *
   * // Generate keyHash from user's private key
   * const userPrivateKey = 'user_secret_key_123';
   * const keyHash = ethers.keccak256(ethers.toUtf8Bytes(userPrivateKey));
   *
   * // Mint NFT
   * const txHash = await ddcnftManager.mint(1n, keyHash);
   * ```
   *
   * @param tokenId - Token ID to mint (must be non-zero)
   * @param keyHash - Key hash (bytes32, keccak256 hash of user's key, cannot be zero hash)
   * @returns Transaction hash
   */
  @ensureDDCNFTDeployed
  async mint(tokenId: bigint, keyHash: string): Promise<string> {
    // this.logger.info(`Minting NFT`, { tokenId });

    // Ensure correct network before transaction
    await this.ensureNetwork();

    const contract = await this.getDDCNFTContract();

    // Validate tokenId
    if (!tokenId || tokenId === 0n) {
      throw new SDKError('tokenId must be non-zero', 'INVALID_TOKEN_ID', { tokenId });
    }

    // Validate keyHash is provided
    if (!keyHash || !keyHash.trim()) {
      throw new SDKError('keyHash is required for minting', 'MISSING_KEY_HASH', { keyHash });
    }

    // Validate keyHash format
    if (keyHash.length !== 66 || !keyHash.startsWith('0x')) {
      throw new SDKError(
        'Invalid keyHash format. Expected bytes32 (0x + 64 hex characters)',
        'INVALID_PARAMETER',
        { keyHash }
      );
    }

    // Validate keyHash is not zero (contract requirement)
    if (keyHash.toLowerCase() === DDCNFTManager.BYTES32_ZERO.toLowerCase()) {
      throw new SDKError(
        'keyHash cannot be bytes32 zero value. Please provide a valid key hash generated from keccak256(key).',
        'INVALID_KEY_HASH',
        { keyHash }
      );
    }

    try {
      // this.logger.info('Sending mint transaction...');
      const tx: ContractTransactionResponse = await contract.mint(tokenId, keyHash);

      // this.logger.info(`Mint transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      // Verify mint via Transfer event
      try {
        this.parseTransferEvent(receipt, tokenId);
      } catch (eventError) {
        // Mint succeeded but event verification failed - log warning but don't fail
        this.logger.warn('Mint completed but event verification failed:', eventError);
      }

      // this.logger.info(`NFT minted successfully. Transaction: ${receipt.hash}`);
      return receipt.hash;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to mint NFT:', error);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract call failed. The token may already exist, you may not have minting permission, or the contract may be paused.',
          'CONTRACT_CALL_FAILED',
          { tokenId, keyHash, originalError: error.message }
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

      throw new SDKError(`Failed to mint NFT: ${error.message || error}`, 'MINT_ERROR', {
        tokenId,
        keyHash,
        error: error.message || error,
      });
    }
  }

  /**
   * Destroy (burn) NFT token
   * @param tokenId - Token ID to destroy
   * @param key - Destroy key
   * @returns Transaction hash
   */
  @ensureDDCNFTDeployed
  async destroy(tokenId: bigint, key: string): Promise<string> {
    // this.logger.info(`Destroying NFT #${tokenId}`);

    // Ensure correct network before transaction
    await this.ensureNetwork();

    const contract = await this.getDDCNFTContract();

    // Validate parameters
    if (!tokenId) {
      throw new SDKError('tokenId is required for destroying', 'MISSING_TOKEN_ID', { tokenId });
    }

    if (!key || !key.trim()) {
      throw new SDKError('Destroy key cannot be empty', 'INVALID_PARAMETER', { key });
    }

    try {
      // this.logger.info('Sending destroy transaction...');
      const tx: ContractTransactionResponse = await contract.destroy(tokenId, key);

      // this.logger.info(`Destroy transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      // Verify destroy via Transfer event (toHash should be zero)
      try {
        this.parseTransferEventForDestroy(receipt, tokenId);
      } catch (eventError) {
        // Transfer event verification failed - log warning but continue
        this.logger.warn('Destroy completed but Transfer event verification failed:', eventError);
      }

      // Verify destroy via TokenDestroyed event
      try {
        this.parseTokenDestroyedEvent(receipt, tokenId);
      } catch (eventError) {
        // TokenDestroyed event verification failed - log warning but don't fail
        this.logger.warn(
          'Destroy completed but TokenDestroyed event verification failed:',
          eventError
        );
      }

      // this.logger.info(`NFT destroyed successfully. Transaction: ${receipt.hash}`);
      return receipt.hash;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to destroy NFT:', error);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract call failed. The token may not exist, the key may be invalid, you may not have destroy permission, or the contract may be paused.',
          'CONTRACT_CALL_FAILED',
          { tokenId, originalError: error.message }
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

      throw new SDKError(`Failed to destroy NFT: ${error.message || error}`, 'DESTROY_ERROR', {
        tokenId,
        error: error.message || error,
      });
    }
  }

  /**
   * Get token URI
   * @param tokenId - Token ID
   * @returns Token URI
   */
  @ensureDDCNFTDeployed
  async getTokenURI(tokenId: bigint): Promise<string> {
    const contract = await this.getDDCNFTContract();

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

  /**
   * Transfer NFT token
   * @param toHash - Recipient private key hash (bytes32)
   * @param tokenId - Token ID
   * @param key - Transfer key
   * @returns Transaction hash
   */
  @ensureDDCNFTDeployed
  async transfer(toHash: string, tokenId: bigint, key: string): Promise<string> {
    // this.logger.info(`Transferring NFT #${tokenId} to ${toHash}`);

    // Ensure correct network before transaction
    await this.ensureNetwork();

    const contract = await this.getDDCNFTContract();

    // Validate toHash is a valid bytes32 value
    if (!toHash || toHash.length !== 66 || !toHash.startsWith('0x')) {
      throw new SDKError(
        'Invalid toHash format. Expected bytes32 (0x + 64 hex characters)',
        'INVALID_PARAMETER',
        { toHash }
      );
    }

    if (!key || !key.trim()) {
      throw new SDKError('Transfer key cannot be empty', 'INVALID_PARAMETER', { key });
    }

    try {
      // this.logger.info('Sending transfer transaction...');
      const tx: ContractTransactionResponse = await contract.transfer(toHash, tokenId, key);

      // this.logger.info(`Transfer transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      // Verify transfer via event
      try {
        this.parseTransferEventForTransfer(receipt, tokenId, toHash);
      } catch (eventError) {
        // Transfer succeeded but event verification failed - log warning but don't fail
        this.logger.warn('Transfer completed but event verification failed:', eventError);
      }

      // this.logger.info(`NFT transferred successfully. Transaction: ${receipt.hash}`);
      return receipt.hash;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to transfer NFT:', error);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract call failed. You may not own this token, the key may be invalid, or the contract may be paused.',
          'CONTRACT_CALL_FAILED',
          { toHash, tokenId, originalError: error.message }
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

      throw new SDKError(`Failed to transfer NFT: ${error.message || error}`, 'TRANSFER_ERROR', {
        toHash,
        tokenId,
        error: error.message || error,
      });
    }
  }

  /**
   * Get the name of the NFT collection
   * @returns Collection name
   */
  @ensureDDCNFTDeployed
  async getName(): Promise<string> {
    const contract = await this.getDDCNFTContract();
    try {
      return await contract.name();
    } catch (error) {
      if (error instanceof SDKError) throw error;
      throw new SDKError(`Failed to get NFT name: ${error}`, 'GET_NAME_ERROR', { error });
    }
  }

  /**
   * Get the symbol of the NFT collection
   * @returns Collection symbol
   */
  @ensureDDCNFTDeployed
  async getSymbol(): Promise<string> {
    const contract = await this.getDDCNFTContract();
    try {
      return await contract.symbol();
    } catch (error) {
      if (error instanceof SDKError) throw error;
      throw new SDKError(`Failed to get NFT symbol: ${error}`, 'GET_SYMBOL_ERROR', { error });
    }
  }

  /**
   * Get the owner of a specific token
   * @param tokenId - Token ID
   * @returns Owner address
   */
  @ensureDDCNFTDeployed
  async getOwnerOf(tokenId: bigint): Promise<string> {
    const contract = await this.getDDCNFTContract();
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
   * Get the contract owner (admin)
   * @returns Contract owner address
   */
  @ensureDDCNFTDeployed
  async getOwner(): Promise<string> {
    const contract = await this.getDDCNFTContract();
    try {
      return await contract.owner();
    } catch (error) {
      if (error instanceof SDKError) throw error;
      throw new SDKError(`Failed to get contract owner: ${error}`, 'GET_OWNER_ERROR', { error });
    }
  }

  getNetworkConfig(): DDCChainConfig {
    if (!this.networkConfig) {
      throw new SDKError('Network config not available', 'NETWORK_CONFIG_NOT_AVAILABLE');
    }
    return this.networkConfig;
  }

  getFactoryAddress(): string {
    if (!this.factoryAddress) {
      throw new SDKError('Factory contract not available', 'FACTORY_CONTRACT_NOT_AVAILABLE');
    }
    return this.factoryAddress;
  }
}

