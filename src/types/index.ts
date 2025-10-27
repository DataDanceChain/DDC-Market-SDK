import type { ContractRunner, Eip1193Provider as EthersEip1193Provider, Signer } from 'ethers';
import type { AxiosError } from 'axios';

/**
 * Manager params for contract operations init
 */
export interface ManagerParams {
  /**
   * Signer for contract operations
   */
  signer: Signer;
  /**
   *  current user wallet address
   */
  walletAddress: string;
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
   * Signer for contract operations
   */
  signer: Signer;
  /**
   *  factory address
   */
  factoryAddress: string;
  /**
   * Enable debug logging
   */
  debug?: boolean;
  /**
   *
   */
  chainConfig: DDCChainConfig;
}

/**
 * DDC Chain configuration
 */
export interface DDCChainConfig {
  /**
   * Chain ID (e.g., 1 for Ethereum Mainnet, 137 for Polygon)
   */
  chainId: number;

  /**
   * Network name (e.g., "Ethereum Mainnet", "Polygon")
   */
  chainName?: string;

  /**
   * RPC URL for the network
   */
  rpc_url?: string;

  /**
   * Block explorer URL
   */
  blockExplorer?: string;

  /**
   * Native currency symbol
   */
  token_symbol: string;
  /**
   * DDC explorer URL
   */
  explore_url: string;
}

/**
 * Network configuration for chain switching
 * Compatible with EIP-3085 (wallet_addEthereumChain) and EIP-3326 (wallet_switchEthereumChain)
 */
export interface NetworkConfig {
  /**
   * Chain ID (e.g., 1 for Ethereum Mainnet, 137 for Polygon)
   */
  chainId: number;

  /**
   * Network name (e.g., "Ethereum Mainnet", "Polygon")
   */
  name?: string;

  /**
   * RPC URL for the network (required for adding new networks)
   */
  rpcUrl?: string;

  /**
   * Block explorer URL
   */
  blockExplorer?: string;

  /**
   * Native currency configuration
   */
  currency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

/**
 * DDCNFT Factory Contract Address  TODO remove
 */
export interface DDCNFTFactoryConfig {
  /**
   * Factory contract address
   */
  factoryAddress: string;
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
 * DDCNFT Metadata
 */
export interface DDCNFTMetadata {
  name: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  [key: string]: unknown;
}

/**
 * Token mint parameters
 */
export interface MintParams {
  to: string;
  tokenId?: bigint;
  metadata?: DDCNFTMetadata;
}

/**
 * Membership tier configuration
 */
export interface MembershipTier {
  tierId: number;
  name: string;
  price: bigint;
  duration: number; // in seconds
  benefits?: string[];
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
    ethereum?: EthereumProvider;

    /**
     * WalletConnect provider instance
     */
    walletConnect?: WalletConnectProvider;

    /**
     * Coinbase Wallet extension provider
     */
    coinbaseWalletExtension?: CoinbaseWalletProvider;

    /**
     * Web3Auth SDK instance
     * Access the provider via: window.web3auth.provider
     */
    web3auth?: Web3AuthInstance;
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
