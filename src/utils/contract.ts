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
 * Decorator to ensure factory contract is deployed before method execution
 * Checks if factoryContract and factoryAddress exist
 * Use this decorator for methods that require factory contract interaction (like deployDDCNFT)
 */
export function ensureFactoryDeployed(
  _target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = function (this: any, ...args: any[]) {
    // First check basic initialization
    if (!this.signer) {
      throw new SDKError(
        'Manager not initialized. Please call init() first.',
        'NOT_INITIALIZED',
        { method: propertyKey }
      );
    }

    // Then check factory contract
    if (!this.factoryContract || !this.factoryAddress) {
      throw new SDKError(
        'Factory contract not deployed. Please deploy the factory contract first using deployDDCFactory() or set an existing factory address using setFactoryAddress().',
        'FACTORY_NOT_DEPLOYED',
        {
          method: propertyKey,
          factoryAddress: this.factoryAddress,
          hasFactoryContract: !!this.factoryContract
        }
      );
    }

    return originalMethod.apply(this, args);
  };

  return descriptor;
}

/**
 * Decorator to ensure DDCNFTManager has a deployed DDCNFT contract to interact with
 * Checks if signer and ddcnftAddress exist
 * Use this decorator for methods that operate on a specific DDCNFT instance (mint, burn, transfer, etc.)
 */
export function ensureDDCNFTDeployed(
  _target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = function (this: any, ...args: any[]) {
    // Check basic initialization
    if (!this.signer) {
      throw new SDKError(
        'DDCNFTManager not initialized. Please call DDCNFTManager.init() first.',
        'NOT_INITIALIZED',
        { method: propertyKey }
      );
    }

    // Check if a DDCNFT contract is set
    if (!this.ddcnftAddress) {
      throw new SDKError(
        'No DDCNFT contract selected. Please deploy a new DDCNFT using deployDDCNFT() or set an existing one using setDDCNFTAddress().',
        'NO_DDCNFT_CONTRACT',
        { method: propertyKey }
      );
    }

    return originalMethod.apply(this, args);
  };

  return descriptor;
}

/**
 * Decorator to ensure MembershipManager has a deployed Membership contract to interact with
 * Checks if signer and membershipAddress exist
 * Use this decorator for methods that operate on a specific Membership instance (mint, burn, transfer, etc.)
 */
export function ensureMembershipDeployed(
  _target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const originalMethod = descriptor.value;

  descriptor.value = function (this: any, ...args: any[]) {
    // Check basic initialization
    if (!this.signer) {
      throw new SDKError(
        'MembershipManager not initialized. Please call MembershipManager.init() first.',
        'NOT_INITIALIZED',
        { method: propertyKey }
      );
    }

    // Check if a Membership contract is set
    if (!this.membershipAddress) {
      throw new SDKError(
        'No Membership contract selected. Please deploy a new Membership using deployMembership() or set an existing one using setMembershipAddress().',
        'NO_MEMBERSHIP_CONTRACT',
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
