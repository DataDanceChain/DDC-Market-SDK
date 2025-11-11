/**
 * DDC Market SDK
 * TypeScript SDK for DDC Market Contract integration
 */

// Export core managers
export { DDCNFTManager } from './ddcnft';
export { MembershipManager } from './membership';

// Export types
export type {
  MintResult,
  DestroyResult,
  DeploymentResult,
  DDCChainConfig,
  ManagerConfig,
  ManagerParams,
  JsonRpcProviderDescriptor,
  SignerConfig,
} from './types';

// Re-export ProviderDescriptor as alias for JsonRpcProviderDescriptor for convenience
export type { ProviderDescriptor } from './types';

export { SDKError } from './types';

// Export utilities
export {
  validateAddress,
  Logger,
  getCurrentNetwork,
  ensureCorrectNetwork,
  getProvider,
  getSigner,
  getAddress,
  getKeyHash,
  createJsonRpcProvider,
  resolveProvider,
} from './utils';

// Export utility types (re-export ethers types for convenience)
export type { JsonRpcApiProviderOptions } from 'ethers';

// Export HTTP service
export { httpService, requestGet, requestPost } from './service';

export type { ApiResponse, ApiRequestConfig } from './types';

/**
 * SDK Version
 */
export const VERSION = '0.1.0';
