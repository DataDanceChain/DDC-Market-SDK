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
} from './types';

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
} from './utils';

// Export HTTP service
export { httpService, requestGet, requestPost } from './service';

export type { ApiResponse, ApiRequestConfig } from './types';

/**
 * SDK Version
 */
export const VERSION = '0.1.0';
