import { SDKError } from '../types';

/**
 * Ensure factory contract is deployed decorator (generic)
 */
export function ensureFactoryDeployed(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (this: any, ...args: any[]) {
    if (!this.factoryContract || !this.factoryAddress) {
      throw new SDKError(
        'Factory contract not deployed. Please deploy factory first using deployFactory().',
        'FACTORY_NOT_DEPLOYED'
      );
    }
    return originalMethod.apply(this, args);
  };

  return descriptor;
}

/**
 * Ensure contract is deployed decorator (generic)
 * Checks if contractAddress exists before executing the method
 */
export function ensureContractDeployed(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (this: any, ...args: any[]) {
    if (!this.contractAddress) {
      throw new SDKError(
        'Contract not deployed. Please deploy a contract first using deployContract().',
        'CONTRACT_NOT_DEPLOYED'
      );
    }
    return originalMethod.apply(this, args);
  };

  return descriptor;
}
