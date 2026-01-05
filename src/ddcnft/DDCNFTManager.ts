import {
  Contract,
  ContractTransactionResponse,
  Interface,
  BrowserProvider,
  JsonRpcProvider,
} from 'ethers';
import type { DeploymentResult, ManagerParams, ManagerConfig } from '../types';
import { SDKError } from '../types';
import { resolveProvider, getSigner, resolveWalletAddress } from '../utils';
import { DDCNFT_ABI, DDCNFT_FACTORY_ABI } from '../abi';
import { authLogin, getDDCConfig, getNonce, uploadSts } from '../service/api';
import DDCNFTFactoryJson from '../abi/DDCNFTFactory.json';
import { BaseManager, ensureFactoryDeployed, ensureContractDeployed } from '../base';
import { createContract, buildLoginMessage, signLoginMessage, uplloadOssStsFile } from '../utils';
import { PutObjectResult } from 'ali-oss';

/**
 * DDCNFT Management API
 * Handles DDCNFT contract deployment and operations
 */
export class DDCNFTManager extends BaseManager<'nft'> {
  protected readonly CONTRACT_ABI = DDCNFT_ABI;
  protected readonly FACTORY_ABI = DDCNFT_FACTORY_ABI;
  protected readonly FACTORY_JSON = DDCNFTFactoryJson;
  protected readonly CONTRACT_TYPE = 'nft' as const;

  private static instance: DDCNFTManager | null = null;

  protected getManagerName(): string {
    return 'DDCNFTManager';
  }

  // Backward compatibility
  public get ddcnftAddress(): string {
    return this.contractAddress || '';
  }

  public set ddcnftAddress(address: string) {
    this.contractAddress = address;
  }

  constructor(config: ManagerConfig) {
    super(config);
  }

  /**
   * Parse deployed contract address from DDCNFTDeployed event
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
            const isZeroHash = fromHash.toLowerCase() === this.BYTES32_ZERO.toLowerCase();

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
            const isZeroHash = toHash.toLowerCase() === this.BYTES32_ZERO.toLowerCase();

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
   * Init Instance of DDCNFTManager
   * Supports both BrowserProvider and JsonRpcProvider modes
   *
   * @param manageConfig - Configuration object
   * @returns DDCNFTManager instance
   *
   * @example
   * ```typescript
   * // BrowserProvider mode - user constructs BrowserProvider
   * import { BrowserProvider } from 'ethers';
   * const manager = await DDCNFTManager.init({
   *   walletAddress: '0x...',
   *   provider: new BrowserProvider(window.ethereum),
   *   debug: true
   * });
   *
   * // JsonRpcProvider mode - using descriptor (SDK constructs for you to avoid version conflicts)
   * // rpcUrl and chainId are automatically fetched from getDDCConfig API
   * const manager = await DDCNFTManager.init({
   *   walletAddress: '0x...',
   *   provider: { type: 'jsonRpc' }, // rpcUrl and chainId auto-filled from API
   *   signer: { privateKey: '0x...' },
   *   debug: true
   * });
   * ```
   **/
  static async init(manageConfig: ManagerParams): Promise<DDCNFTManager> {
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

    const { nft_factory_address, network, nft_address, metadata_url } = result.data.data;

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
      factoryAddress: nft_factory_address,
      signerConfig: signer,
    };

    this.instance = new DDCNFTManager(config);
    await this.instance.ensureNetwork();

    if (config.factoryAddress) {
      this.instance.factoryAddress = config.factoryAddress;
      if (!this.instance.provider) {
        throw new SDKError('Provider is not available', 'PROVIDER_NOT_AVAILABLE');
      }
      const signerInstance = await getSigner(this.instance.provider, this.instance.signerConfig);
      this.instance.factoryContract = createContract(
        config.factoryAddress,
        DDCNFT_FACTORY_ABI,
        signerInstance
      );
    }

    if (nft_address) {
      this.instance.deployedContracts = [...nft_address];
    }

    if (metadata_url) {
      this.instance.metadataUrl = metadata_url;
    }

    return this.instance;
  }

  /**
   * Deploy DDCNFTFactory contract (alias for base deployFactory)
   * @deprecated Use deployFactory() instead
   */
  async deployDDCFactory(): Promise<DeploymentResult> {
    return this.deployFactory();
  }

  /**
   * Deploy a new DDCNFT contract via factory (alias for base deployContract)
   * @deprecated Use deployContract() instead
   */
  @ensureFactoryDeployed
  async deployDDCNFT(name: string, symbol: string): Promise<DeploymentResult> {
    return this.deployContract(name, symbol);
  }

  /**
   * pause the DDCNFT contract
   * @returns Transaction hash
   */
  async pause(): Promise<string> {
    const contract = await this.getContract();

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
    const contract = await this.getContract();
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
   * Protected Auth API for internal use
   * 1. Get nonce
   * 2. Build login message
   * 3. Sign login message
   * 4. Login
   * 5. Return jwt  token
   * @returns Auth token
   */
  @ensureContractDeployed
  protected async _authApi(): Promise<{
    token: string;
    tokenType: string;
    expiresAt: string;
    address: string;
  }> {
    const signer = await this.getSigner();
    const address = await signer.getAddress();
    console.log('address is:', address);
    const result = await getNonce({ address });
    if (!result.data) {
      throw new SDKError('Failed to get nonce', 'GET_NONCE_ERROR', { result });
    }
    const { nonce, expiresAt } = result.data.data;
    const message = buildLoginMessage({ address, nonce, expiresAt });
    const { signature, walletAddress } = await signLoginMessage(signer, message);
    const res = await authLogin({ address, message, signature });
    if (!res.data) {
      throw new SDKError('Failed to login', 'AUTH_LOGIN_ERROR', { result });
    }
    console.log('authLogin result is:', res);
    const { expiresAt: expiresAtString, token } = res.data.data;
    this.authToken = token;
    this.authExpiresAt = expiresAtString;
    return { ...res.data.data };
  }

  /**
   * Upload metadata file to DDCNFT contract
   * @param file - File to upload
   * @returns Metadata file URI
   */
  public async uploadMetadataFile(file: File): Promise<{ fileUrl: string; fileName: string }> {
    if (!this.authToken || new Date(this.authExpiresAt || '').valueOf() <= Date.now()) {
      this.authToken = '';
      this.authExpiresAt = '';
      await this._authApi();
    }

    const signer = await this.getSigner();
    const address = await signer.getAddress();
    const contractAddress = this.getContractAddress()?.toLowerCase() || '';
    //
    const ext = file.name.split('.').pop() || '';
    // query oss sts token
    const result = await uploadSts(
      {
        address,
        contract: contractAddress,
        ext,
      },
      {
        headers: {
          Authorization: `Bearer ${this.authToken}`,
        },
      }
    );
    console.log('uploadMetadataFile result is:', result);
    const { fileId, objectUrlHint, callback, sts, region, objectKey } = result.data?.data || {};
    const { accessKeyId, accessKeySecret, securityToken } = sts || {};
    // const fileName = `${fileId}.${ext}`;
    const keys = objectKey?.split('/');
    const fileName =
      keys && keys.length > 1 ? keys.slice(1).join('/') : objectKey || `${fileId}.${ext}`;
    const bucket = `${keys?.[0]}` || '';
    // upload file to oss
    const ossResult: PutObjectResult = await uplloadOssStsFile(file, {
      fileName: fileName,
      accessKeyId: accessKeyId || '',
      accessKeySecret: accessKeySecret || '',
      stsToken: securityToken || '',
      region: region || '',
      bucket: bucket || '',
    });
    console.log('uploadMetadataFile ossResult is:', ossResult);
    const { url: originOssUrl, name } = ossResult;
    return { fileUrl: objectUrlHint || '', fileName: name || '' };
  }

  public async updateMetadata(description: string): Promise<string> {
    if (!this.authToken || new Date(this.authExpiresAt || '').valueOf() <= Date.now()) {
      this.authToken = '';
      this.authExpiresAt = '';
      await this._authApi();
    }

    return '';
  }

  /**
   * Set an individual full URI for a specific token
   * Use only when the token needs completely different metadata from others
   * Each call consumes an additional storage slot (~20,000 gas) - not recommended for bulk use
   *
   * @param tokenId - Token ID to set URI for
   * @param uri - Full URI string for the token
   * @returns Transaction hash
   */
  @ensureContractDeployed
  async setTokenURI(tokenId: bigint, uri: string): Promise<string> {
    await this.ensureNetwork();
    const contract = await this.getContract();

    // Validate tokenId
    if (!tokenId || tokenId === 0n) {
      throw new SDKError('tokenId must be non-zero', 'INVALID_TOKEN_ID', { tokenId });
    }

    // Validate uri
    if (!uri || typeof uri !== 'string') {
      throw new SDKError('uri must be a non-empty string', 'INVALID_PARAMETER', { uri });
    }

    try {
      // step 1: auth api
      // await this._authApi(tokenId, uri);
      // step 2: set token uri
      const tx: ContractTransactionResponse = await contract.setTokenURI(tokenId, uri);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      return receipt.hash;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to set token URI:', error);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract call failed. The token may not exist, you may not have permission to set URI, or the contract may be paused.',
          'CONTRACT_CALL_FAILED',
          { tokenId, uri, originalError: error.message }
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
        `Failed to set token URI: ${error.message || error}`,
        'SET_TOKEN_URI_ERROR',
        {
          tokenId,
          uri,
          error: error.message || error,
        }
      );
    }
  }

  /**
   * Clear the individual URI for a specific token
   * After clearing, the token will fall back to using baseURI + tokenId
   * This frees up the storage slot used by the individual URI
   *
   * @param tokenId - Token ID to clear URI for
   * @returns Transaction hash
   */
  @ensureContractDeployed
  async clearTokenURI(tokenId: bigint): Promise<string> {
    await this.ensureNetwork();
    const contract = await this.getContract();

    // Validate tokenId
    if (!tokenId || tokenId === 0n) {
      throw new SDKError('tokenId must be non-zero', 'INVALID_TOKEN_ID', { tokenId });
    }

    try {
      const tx: ContractTransactionResponse = await contract.clearTokenURI(tokenId);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      return receipt.hash;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to clear token URI:', error);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract call failed. The token may not exist, you may not have permission to clear URI, or the contract may be paused.',
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

      throw new SDKError(
        `Failed to clear token URI: ${error.message || error}`,
        'CLEAR_TOKEN_URI_ERROR',
        {
          tokenId,
          error: error.message || error,
        }
      );
    }
  }

  /**
   * Get the current active DDCNFT contract address
   * @deprecated Use getContractAddress() instead
   */
  getDDCNFTAddress(): string | undefined {
    return this.getContractAddress();
  }

  /**
   * Set the current active DDCNFT contract address
   * @deprecated Use setContractAddress() instead
   */
  setDDCNFTAddress(address: string): void {
    this.setContractAddress(address);
  }

  /**
   * Get DDCNFT contract instance
   * @param contractAddress - DDCNFT contract address (optional, uses stored address if not provided)
   * @returns Contract instance
   * @deprecated Use getContract() instead
   */
  async getDDCNFTContract(contractAddress?: string): Promise<Contract> {
    return this.getContract(contractAddress);
  }

  /**
   * Mint NFT token
   * Note: NFT will be minted to the contract owner (caller of this function)
   *
   * @param tokenId - Token ID to mint (must be non-zero)
   * @param keyHash - Key hash (bytes32, keccak256 hash of user's key, cannot be zero hash)
   * @returns Transaction hash
   */
  @ensureContractDeployed
  async mint(tokenId: bigint, keyHash: string): Promise<string> {
    await this.ensureNetwork();
    const contract = await this.getContract();

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
    if (keyHash.toLowerCase() === this.BYTES32_ZERO.toLowerCase()) {
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
   * @param key - Private key to destroy
   * @returns Transaction hash
   */
  @ensureContractDeployed
  async destroy(tokenId: bigint, key: string): Promise<string> {
    await this.ensureNetwork();
    const contract = await this.getContract();

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
   * Transfer NFT token
   * @param toHash - Recipient private key hash (bytes32)
   * @param tokenId - Token ID
   * @param key - Transfer key
   * @returns Transaction hash
   */
  @ensureContractDeployed
  async transfer(toHash: string, tokenId: bigint, key: string): Promise<string> {
    await this.ensureNetwork();
    const contract = await this.getContract();

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
}
