import { Contract, InterfaceAbi, isAddress, getAddress, Signer } from 'ethers';
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
