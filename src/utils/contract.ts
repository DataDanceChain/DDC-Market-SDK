import { Contract, ContractRunner, InterfaceAbi, isAddress, getAddress, Signer } from 'ethers';
import { SDKError } from '../types';

/**
 * Create a contract instance with error handling
 * Read & Write Contract operations
 */
export function createContract(address: string, abi: InterfaceAbi, runner: Signer): Contract {
  try {
    return new Contract(address, abi, runner);
  } catch (error) {
    throw new SDKError(`Failed to create contract instance: ${error}`, 'CONTRACT_CREATION_ERROR', {
      address,
      error,
    });
  }
}

/**
 * Decorator to ensure MembershipManager instance is initialized before method execution
 * Checks if factoryContract and signer exist as proxy for initialization state
 */
export function ensureInitialized(
  _target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = function (this: any, ...args: any[]) {
    if (!this.signer || !this.membershipAddress) {
      throw new SDKError(
        'MembershipManager not initialized. Please call MembershipManager.init() first.',
        'NOT_INITIALIZED',
        { method: propertyKey }
      );
    }
    return originalMethod.apply(this, args);
  };

  return descriptor;
}

/**
 * push address to target without duplicates
 * @param this - MembershipManager instance
 * @returns true if initialized, false otherwise
 */
export function addAddress(target: Array<string>, address: string): Array<string> {
  if (target.includes(address)) {
    return target;
  }
  target.push(address);
  return target;
}

/**
 * Check if the runner is a Signer (can sign transactions)
 * In ethers.js v6, Signers have signMessage and sendTransaction methods
 * @param runner - The contract runner to check
 * @returns true if runner is a Signer, false otherwise
 */
export function isSigner(runner: ContractRunner): boolean {
  // Check if runner has Signer-specific methods
  return (
    runner !== null &&
    runner !== undefined &&
    typeof (runner as any).signMessage === 'function' &&
    typeof (runner as any).sendTransaction === 'function'
  );
}

/**
 * Verify that the runner is a Signer (required for write operations)
 * @param runner - The contract runner to verify
 * @param operation - Name of the operation requiring a Signer (for error message)
 * @throws {SDKError} If runner is not a Signer
 */
export function requireSigner(runner: ContractRunner, operation: string): void {
  if (!isSigner(runner)) {
    throw new SDKError(
      `Operation "${operation}" requires a Signer (e.g., ethers.Wallet or provider.getSigner()), but a read-only Provider was provided. Please use a Signer for write operations.`,
      'SIGNER_REQUIRED',
      { operation }
    );
  }
}

/**
 * Validate Ethereum address using ethers.js
 * @param address - Address to validate
 * @returns Whether the address is valid
 */
export function isValidAddress(address: string): boolean {
  return isAddress(address);
}

/**
 * Validate and normalize Ethereum address
 * @param address - Address to validate
 * @param label - Label for error message (default: 'Address')
 * @throws {SDKError} If address is invalid
 */
export function validateAddress(address: string, label: string = 'Address'): void {
  if (!isAddress(address)) {
    throw new SDKError(`${label} is invalid: ${address}`, 'INVALID_ADDRESS', { address, label });
  }
}

/**
 * Get checksummed address
 * @param address - Address to normalize
 * @returns Checksummed address
 * @throws {SDKError} If address is invalid
 */
export function getChecksumAddress(address: string): string {
  try {
    return getAddress(address);
  } catch (error) {
    throw new SDKError(`Invalid Ethereum address: ${address}`, 'INVALID_ADDRESS', {
      address,
      error,
    });
  }
}
