import type {
  Eip1193Provider as EthersEip1193Provider,
  Provider,
  Signer,
  BrowserProvider,
} from 'ethers';
import type { AxiosError } from 'axios';

/**
 * Provider descriptor for JsonRpcProvider mode
 * Direct RPC connection to blockchain node
 *
 * Note: For BrowserProvider mode, users should construct BrowserProvider directly
 * (e.g., `new BrowserProvider(window.ethereum)`) and pass it as Provider.
 * SDK does not provide a descriptor for BrowserProvider to avoid ethers version conflicts.
 *
 * For JsonRpcProvider mode, rpcUrl and chainId are automatically fetched from
 * getDDCConfig API response (network.rpc_url and network.chain_id).
 * No parameters needed - just use { type: 'jsonRpc' }.
 */
export interface JsonRpcProviderDescriptor {
  type: 'jsonRpc';
}

/**
 * Provider descriptor - only for JsonRpcProvider mode
 * BrowserProvider should be constructed by users and passed directly as Provider
 */
export type ProviderDescriptor = JsonRpcProviderDescriptor;

/**
 * Signer configuration for JsonRpcProvider mode
 */
export interface SignerConfig {
  /**
   * Private key for signing transactions (required for JsonRpcProvider mode)
   */
  privateKey: string;
}

/**
 * Manager params for contract operations init
 * Supports BrowserProvider (user-constructed) and JsonRpcProvider (via descriptor only)
 */
export interface ManagerParams {
  /**
   * Provider for contract operations
   * Can be:
   * - BrowserProvider instance (user constructs it, e.g., new BrowserProvider(window.ethereum))
   * - JsonRpcProviderDescriptor (SDK will construct JsonRpcProvider for you using SDK's ethers version)
   *
   * Note: For JsonRpcProvider, use descriptor instead of constructing directly to avoid ethers version conflicts.
   * SDK's createJsonRpcProvider ensures compatibility with SDK's internal ethers version.
   */
  provider: BrowserProvider | JsonRpcProviderDescriptor;
  /**
   * Current user wallet address
   */
  walletAddress: string;
  /**
   * Signer configuration (required for JsonRpcProvider mode)
   * When using JsonRpcProvider, provide privateKey to sign transactions
   */
  signer?: SignerConfig;
  /**
   * Enable debug logging
   */
  debug?: boolean;
}

/**
 * Manager configuration for Manager Constructor
 */
export interface ManagerConfig {
  /**
   * Provider for contract operations
   */
  provider: Provider;
  /**
   * DDCNFT factory contract address
   */
  factoryAddress: string;
  /**
   * Enable debug logging
   */
  debug?: boolean;
  /**
   * Chain configuration
   */
  network: DDCChainConfig;
  /**
   * Signer configuration (required for JsonRpcProvider mode)
   * When using JsonRpcProvider, provide privateKey to sign transactions
   */
  signerConfig?: SignerConfig;
}

/**
 * DDC Chain configuration
 */
export interface DDCChainConfig {
  /**
   * Chain ID (e.g., 1 for Ethereum Mainnet, 137 for Polygon)
   */
  chain_id: number;
  /**
   * Network name (e.g., "Ethereum Mainnet", "Polygon")
   */
  chain_name?: string;

  /**
   * RPC URL for the network
   */
  rpc_url?: string;

  /**
   * Native currency symbol
   */
  token_symbol: string;
  /**
   * DDC explorer URL
   */
  explore_url?: string;
  /**
   * Block explorer URL
   */
  blockExplorer?: string;
}

/**
 * Base contract deployment result
 */
export interface DeploymentResult {
  /**
   * Deployed contract address
   */
  contractAddress: string;

  /**
   * Transaction hash
   */
  transactionHash: string;

  /**
   * Block number where contract was deployed
   */
  blockNumber?: number;
}

/**
 * Token mint result
 */
export interface MintResult {
  /**
   * Minted token ID
   */
  tokenId: bigint;

  /**
   * Recipient address hash (bytes32)
   */
  to: string;

  /**
   * Transaction hash
   */
  transactionHash: string;

  /**
   * Block number where token was minted
   */
  blockNumber?: number;
}

/**
 * Token destroy (burn) result
 */
export interface DestroyResult {
  /**
   * Destroyed token ID
   */
  tokenId: bigint;

  /**
   * Previous owner address hash (bytes32)
   */
  from: string;

  /**
   * Transaction hash
   */
  transactionHash: string;

  /**
   * Block number where token was destroyed
   */
  blockNumber?: number;
}

/**
 * SDK Error types
 */
export class SDKError extends Error {
  constructor(message: string, public readonly code: string, public readonly data?: unknown) {
    super(message);
    this.name = 'SDKError';
  }
}

/**
 * Re-export Eip1193Provider from ethers.js
 * This is the standard EIP-1193 provider interface defined by ethers.js v6
 * @see https://eips.ethereum.org/EIPS/eip-1193
 */
export type Eip1193Provider = EthersEip1193Provider;

/**
 * MetaMask and standard EVM wallet provider interface
 * Extends EIP-1193 with wallet-specific properties
 */
export interface EthereumProvider extends EthersEip1193Provider {
  isMetaMask?: boolean;
  isConnected?(): boolean;
  selectedAddress?: string | null;
  chainId?: string;
  networkVersion?: string;
  enable?(): Promise<string[]>;
}

/**
 * WalletConnect provider interface
 */
export interface WalletConnectProvider extends EthersEip1193Provider {
  isWalletConnect?: boolean;
  enable?(): Promise<string[]>;
  disconnect?(): Promise<void>;
}

/**
 * Coinbase Wallet provider interface
 */
export interface CoinbaseWalletProvider extends EthersEip1193Provider {
  isCoinbaseWallet?: boolean;
  selectedAddress?: string | null;
  chainId?: string;
  enable?(): Promise<string[]>;
  disconnect?(): Promise<void>;
}

/**
 * Web3Auth provider interface
 * MetaMask Embedded Wallets SDK (formerly Web3Auth) provider
 * Provides EIP-1193 compatible provider for embedded wallet functionality
 */
export interface Web3AuthProvider extends EthersEip1193Provider {
  /**
   * Connected user information (specific to Web3Auth)
   */
  user?: {
    email?: string;
    name?: string;
    profileImage?: string;
    aggregateVerifier?: string;
    verifier?: string;
    verifierId?: string;
    typeOfLogin?: string;
    idToken?: string;
  };
}

/**
 * Web3Auth instance interface (SDK instance)
 * This represents the main Web3Auth SDK instance
 */
export interface Web3AuthInstance {
  /**
   * The EIP-1193 compatible provider exposed by Web3Auth
   * Use this with ethers.js BrowserProvider
   */
  provider: Web3AuthProvider | null;

  /**
   * Initialize the Web3Auth SDK
   */
  init(): Promise<void>;

  /**
   * Connect to Web3Auth (triggers authentication flow)
   */
  connect(): Promise<Web3AuthProvider | null>;

  /**
   * Disconnect from Web3Auth
   */
  logout(): Promise<void>;

  /**
   * Check if user is connected
   */
  connected: boolean;

  /**
   * Get user information
   */
  getUserInfo(): Promise<Partial<Web3AuthProvider['user']>>;
}

/**
 * Global window interface extensions for wallet providers
 */
declare global {
  interface Window {
    /**
     * Standard Ethereum provider (MetaMask, injected wallets)
     * EIP-1193 compatible provider injected by browser wallets
     */
    // ethereum?: EthereumProvider;
    /**
     * WalletConnect provider instance
     */
    // walletConnect?: WalletConnectProvider;
    /**
     * Coinbase Wallet extension provider
     */
    // coinbaseWalletExtension?: CoinbaseWalletProvider;
    /**
     * Web3Auth SDK instance
     * Access the provider via: window.web3auth.provider
     */
    // web3auth?: Web3AuthInstance;
  }
}

/**
 * API Response wrapper for HTTP requests
 * Provides a unified response format for both success and error cases
 *
 * This is NOT a union type - it's a single unified structure where:
 * - success === true: data is present, error is null
 * - success === false: data is null, error is present
 *
 * @example
 * ```typescript
 * const response = await requestGet<User>('/users/123');
 *
 * if (response.success) {
 *   // TypeScript knows response.data is User (not null)
 *   console.log(response.data.name);
 * } else {
 *   // TypeScript knows response.error is AxiosError (not null)
 *   console.error(response.error.message);
 * }
 * ```
 */
export type ApiResponse<T = unknown> =
  | {
      /**
       * Indicates the request was successful
       */
      success: true;
      /**
       * Response data (non-null when success is true)
       */
      data: T;
      /**
       * Error is always null when success is true
       */
      error: null;
      /**
       * HTTP status code
       */
      status: number;
    }
  | {
      /**
       * Indicates the request failed
       */
      success: false;
      /**
       * Data is always null when success is false
       */
      data: null;
      /**
       * Error object (non-null when success is false)
       */
      error: AxiosError;
      /**
       * HTTP status code (if available)
       */
      status: number | null;
    };

/**
 * API Request configuration
 * Extends axios request config with commonly used options
 */
export interface ApiRequestConfig {
  /**
   * URL query parameters
   */
  params?: Record<string, any>;

  /**
   * Custom request headers
   */
  headers?: Record<string, string>;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * withCredentials indicates whether or not cross-site Access-Control requests
   * should be made using credentials
   */
  withCredentials?: boolean;

  /**
   * Response type
   */
  responseType?: 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream';
}
