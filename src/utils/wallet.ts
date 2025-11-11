import {
  BrowserProvider,
  JsonRpcProvider,
  Wallet,
  keccak256,
  toUtf8Bytes,
  Signer,
  JsonRpcSigner,
  Provider,
  type JsonRpcApiProviderOptions,
} from 'ethers';
import { SDKError, JsonRpcProviderDescriptor, SignerConfig } from '../types';

/**
 * Create a JsonRpcProvider instance
 * SDK-provided method to avoid ethers version conflicts
 *
 * @param rpcUrl - RPC URL for the blockchain node
 * @param chainId - Chain ID
 * @param options - Provider configuration options (staticNetwork defaults to true if not specified)
 * @returns JsonRpcProvider instance
 *
 * @example
 * ```typescript
 * // Basic usage
 * const provider = createJsonRpcProvider('https://mainnet.infura.io/v3/YOUR_KEY', 1, {});
 *
 * // With custom options
 * const provider = createJsonRpcProvider('https://mainnet.infura.io/v3/YOUR_KEY', 1, {
 *   batchMaxCount: 10, // Enable batching with max 10 requests
 *   staticNetwork: false, // Override default staticNetwork
 *   polling: true,
 * });
 * ```
 */
export function createJsonRpcProvider(
  rpcUrl: string,
  chainId: number,
  options?: JsonRpcApiProviderOptions
): JsonRpcProvider {
  if (!rpcUrl || typeof rpcUrl !== 'string') {
    throw new SDKError('RPC URL is required and must be a string', 'INVALID_PARAMETER', { rpcUrl });
  }

  try {
    // Default options: disable batch requests to avoid Parse error from RPC servers
    // that don't support batch requests (e.g., some custom RPC endpoints)
    // staticNetwork defaults to true if not specified in options
    const mergedOptions: JsonRpcApiProviderOptions = {
      batchMaxCount: 1, // Disable batching by default - send requests individually
      staticNetwork: options?.staticNetwork !== undefined ? options?.staticNetwork : true, // Default to true
      ...options,
    };

    return new JsonRpcProvider(rpcUrl, chainId, mergedOptions);
  } catch (error: any) {
    throw new SDKError(
      `Failed to create JsonRpcProvider: ${error.message || error}`,
      'PROVIDER_CREATION_ERROR',
      { rpcUrl, chainId, options, error: error.message || error }
    );
  }
}

/**
 * Resolve Provider from descriptor or BrowserProvider instance
 * - If it's a BrowserProvider instance, return as-is
 * - If it's a JsonRpcProviderDescriptor, construct JsonRpcProvider using SDK's ethers version
 *
 * Note: JsonRpcProvider must be constructed via descriptor to avoid ethers version conflicts.
 * User-constructed JsonRpcProvider instances may use different ethers versions, causing
 * instanceof checks and type compatibility issues.
 *
 * For JsonRpcProviderDescriptor, networkConfig is required to get rpcUrl and chainId
 * from getDDCConfig API response.
 *
 * @param providerOrDescriptor - BrowserProvider instance or JsonRpcProviderDescriptor
 * @param networkConfig - Network config from getDDCConfig API (required for JsonRpcProviderDescriptor)
 * @returns Resolved Provider instance
 */
export function resolveProvider(
  providerOrDescriptor: BrowserProvider | JsonRpcProviderDescriptor,
  networkConfig: { rpc_url: string; chain_id: number }
): Provider {
  // If it's a BrowserProvider instance, return as-is
  if (providerOrDescriptor instanceof BrowserProvider) {
    return providerOrDescriptor;
  }

  // Otherwise, it should be a JsonRpcProviderDescriptor
  const descriptor = providerOrDescriptor as JsonRpcProviderDescriptor;

  if (!descriptor || typeof descriptor !== 'object' || descriptor.type !== 'jsonRpc') {
    throw new SDKError(
      'Invalid provider: must be a BrowserProvider instance or JsonRpcProviderDescriptor. ' +
        'For JsonRpcProvider, use descriptor to avoid ethers version conflicts.',
      'INVALID_PROVIDER',
      { providerOrDescriptor }
    );
  }

  // Get rpcUrl and chainId from networkConfig (from getDDCConfig API)
  const { rpc_url, chain_id } = networkConfig;

  // if (!rpc_url) {
  //   throw new SDKError(
  //     'RPC URL is required for JsonRpcProvider. Ensure network.rpc_url is available from getDDCConfig API.',
  //     'MISSING_RPC_URL',
  //     { descriptor, networkConfig }
  //   );
  // }

  // if (chain_id === undefined) {
  //   throw new SDKError(
  //     'Chain ID is required for JsonRpcProvider. Ensure network.chain_id is available from getDDCConfig API.',
  //     'MISSING_CHAIN_ID',
  //     { descriptor, networkConfig }
  //   );
  // }

  // Construct JsonRpcProvider using SDK's ethers version
  return createJsonRpcProvider(rpc_url, chain_id);
}

/**
 * Create a unified ethers Provider
 * - Prefer BrowserProvider (window.ethereum or provided EIP-1193)
 * - Fallback to JsonRpcProvider when rpcUrl is provided
 * @deprecated Use resolveProvider() instead for better type safety
 */
export const getProvider = (eip1193Object: any): BrowserProvider => {
  return new BrowserProvider(eip1193Object);
};

/**
 * Get signer from provider
 * Supports both BrowserProvider and JsonRpcProvider modes
 *
 * @param provider - Provider instance (BrowserProvider or JsonRpcProvider)
 * @param signerConfig - Optional signer configuration (required for JsonRpcProvider)
 * @returns ethers.js Signer instance for signing transactions
 * @throws {Error} If provider is invalid or signer cannot be created
 *
 * @example
 * ```typescript
 * // With BrowserProvider (MetaMask, Web3Auth, etc.)
 * const browserProvider = new BrowserProvider(window.ethereum);
 * const signer = await getSigner(browserProvider);
 *
 * // With JsonRpcProvider (requires private key)
 * const jsonRpcProvider = createJsonRpcProvider('https://mainnet.infura.io/v3/KEY', 1, {});
 * const signer = await getSigner(jsonRpcProvider, { privateKey: '0x...' });
 * ```
 */
export async function getSigner(provider: Provider, signerConfig?: SignerConfig): Promise<Signer> {
  if (!provider) {
    throw new SDKError('Provider is required', 'INVALID_PARAMETER', { provider });
  }

  // Check if it's a BrowserProvider (has getSigner method)
  if (provider instanceof BrowserProvider) {
    return await provider.getSigner();
  }

  // Check if it's a JsonRpcProvider
  if (provider instanceof JsonRpcProvider) {
    if (!signerConfig || !signerConfig.privateKey) {
      throw new SDKError(
        'Private key is required for JsonRpcProvider mode. Please provide signerConfig with privateKey.',
        'MISSING_PRIVATE_KEY',
        { providerType: 'JsonRpcProvider' }
      );
    }

    try {
      const wallet = new Wallet(signerConfig.privateKey, provider);
      return wallet;
    } catch (error: any) {
      throw new SDKError(
        `Failed to create Wallet from private key: ${error.message || error}`,
        'WALLET_CREATION_ERROR',
        { error: error.message || error }
      );
    }
  }

  // Fallback: try to get signer if provider has getSigner method
  if (typeof (provider as any).getSigner === 'function') {
    try {
      return await (provider as any).getSigner();
    } catch (error: any) {
      throw new SDKError(
        `Failed to get signer from provider: ${error.message || error}`,
        'GET_SIGNER_ERROR',
        { error: error.message || error }
      );
    }
  }

  throw new SDKError(
    'Provider does not support signer creation. For JsonRpcProvider, provide signerConfig with privateKey.',
    'UNSUPPORTED_PROVIDER',
    { providerType: provider.constructor.name }
  );
}

/**
 * Get address from a signer
 */
export const getAddress = async (signer: Signer | JsonRpcSigner): Promise<string> => {
  if (!signer) {
    throw new SDKError('Signer is required', 'INVALID_PARAMETER', { signer });
  }
  return await signer.getAddress();
};

/**
 * Get wallet address from private key
 * Wallet object has address property that can be accessed synchronously
 *
 * @param privateKey - Private key string
 * @returns Wallet address
 * @throws {SDKError} If private key is invalid
 *
 * @example
 * ```typescript
 * import { getAddressFromPrivateKey } from '@ddc-market/sdk';
 *
 * const address = getAddressFromPrivateKey('0x...');
 * console.log(`Wallet address: ${address}`);
 * ```
 */
export function getAddressFromPrivateKey(privateKey: string): string {
  if (!privateKey || typeof privateKey !== 'string') {
    throw new SDKError('Private key is required and must be a string', 'INVALID_PARAMETER', {
      privateKey,
    });
  }

  try {
    // Wallet can be created without provider to get address synchronously
    const wallet = new Wallet(privateKey);
    return wallet.address;
  } catch (error: any) {
    throw new SDKError(
      `Failed to get address from private key: ${error.message || error}`,
      'ADDRESS_EXTRACTION_ERROR',
      { error: error.message || error }
    );
  }
}

/**
 * Resolve wallet address from ManagerParams
 * If JsonRpcProvider mode and signer provided, extract address from privateKey
 * Otherwise, use the provided walletAddress
 *
 * @param provider - Provider instance or descriptor
 * @param walletAddress - Wallet address (optional for JsonRpcProvider mode)
 * @param signer - Signer configuration (optional)
 * @returns Resolved wallet address
 * @throws {SDKError} If address cannot be resolved
 *
 * @example
 * ```typescript
 * import { resolveWalletAddress } from '@ddc-market/sdk';
 *
 * // JsonRpcProvider mode - extract from privateKey
 * const address = resolveWalletAddress(
 *   { type: 'jsonRpc' },
 *   undefined,
 *   { privateKey: '0x...' }
 * );
 *
 * // BrowserProvider mode - use provided address
 * const address = resolveWalletAddress(
 *   new BrowserProvider(window.ethereum),
 *   '0x...',
 *   undefined
 * );
 * ```
 */
export function resolveWalletAddress(
  provider: BrowserProvider | JsonRpcProviderDescriptor,
  walletAddress: string | undefined,
  signer?: SignerConfig
): string {
  // Check if it's JsonRpcProvider mode (descriptor with type 'jsonRpc')
  const isJsonRpcProvider =
    typeof provider === 'object' &&
    'type' in provider &&
    provider.type === 'jsonRpc' &&
    signer?.privateKey;

  if (isJsonRpcProvider) {
    // Extract address from private key (Wallet object has address property)
    return getAddressFromPrivateKey(signer.privateKey);
  }

  // For BrowserProvider mode, walletAddress is required
  if (!walletAddress) {
    throw new SDKError(
      'walletAddress is required for BrowserProvider mode, or provide signer.privateKey for JsonRpcProvider mode',
      'MISSING_WALLET_ADDRESS',
      { provider, hasSigner: !!signer }
    );
  }

  return walletAddress;
}

/**
 * Generate a bytes32 hash from a key string
 * This is commonly used for NFT operations (mint, transfer, destroy)
 *
 * @param key - The key string to hash (e.g., user's private key or secret)
 * @returns A bytes32 hash (0x + 64 hex characters) generated using keccak256
 * @throws {SDKError} If key is empty or invalid
 *
 * @example
 * ```typescript
 * import { generateKeyHash } from '@ddc-market/sdk';
 *
 * // Generate keyHash for minting
 * const userKey = 'user_secret_key_123';
 * const keyHash = generateKeyHash(userKey);
 * // keyHash = '0x...' (64 hex characters)
 *
 * // Use with DDCNFTManager
 * await ddcnftManager.mint(1n, keyHash);
 *
 * // Generate recipient hash for transfer
 * const recipientKey = 'recipient_secret_key_456';
 * const recipientHash = generateKeyHash(recipientKey);
 * await ddcnftManager.transfer(recipientHash, 1n, userKey);
 * ```
 */
export const getKeyHash = (key: string): string => {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    throw new SDKError('Key must be a non-empty string', 'INVALID_PARAMETER', { key });
  }

  try {
    // Convert string to UTF-8 bytes and compute keccak256 hash
    const hash = keccak256(toUtf8Bytes(key));
    return hash;
  } catch (error: any) {
    throw new SDKError(
      `Failed to generate key hash: ${error.message || error}`,
      'KEY_HASH_GENERATION_ERROR',
      { key, error: error.message || error }
    );
  }
};
