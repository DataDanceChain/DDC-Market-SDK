import { Provider, JsonRpcProvider, BrowserProvider, Signer } from 'ethers';
import type { NetworkConfig } from '../types';
import { SDKError } from '../types';

/**
 * Logger utility
 */
export class Logger {
  public readonly debug: boolean;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  info(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[DDC SDK] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[DDC SDK WARNING] ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[DDC SDK ERROR] ${message}`, ...args);
  }
}

/**
 * Get provider from runner (ContractRunner can be Provider or Signer)
 */
export async function getProviderFromRunner(runner: unknown): Promise<Provider> {
  // If it's a Signer, get its provider
  if (runner && typeof runner === 'object' && 'provider' in runner) {
    const signer = runner as Signer;
    if (signer.provider) {
      return signer.provider;
    }
  }

  // If it's already a Provider
  if (runner && typeof runner === 'object' && 'getNetwork' in runner) {
    return runner as Provider;
  }

  throw new SDKError(
    'Invalid runner: must be a Provider or Signer with a provider',
    'INVALID_RUNNER'
  );
}

/**
 * Check if current network matches expected chainId
 */
export async function validateNetwork(
  runner: unknown,
  expectedChainId: number,
  logger: Logger
): Promise<boolean> {
  try {
    const provider = await getProviderFromRunner(runner);
    const network = await provider.getNetwork();
    const currentChainId = Number(network.chainId);

    logger.info(`Current chain ID: ${currentChainId}, Expected: ${expectedChainId}`);

    if (currentChainId !== expectedChainId) {
      logger.warn(
        `Network mismatch! Current: ${currentChainId}, Expected: ${expectedChainId}`
      );
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Failed to validate network:', error);
    throw new SDKError(
      `Failed to validate network: ${error}`,
      'NETWORK_VALIDATION_ERROR',
      { expectedChainId, error }
    );
  }
}

/**
 * Get ethereum provider from browser window (if available)
 */
function getEthereumProvider(): any {
  // Check if running in browser
  if (typeof window !== 'undefined') {
    return (window as any).ethereum;
  }
  return undefined;
}

/**
 * Switch network in browser wallet (MetaMask, etc.)
 */
export async function switchNetwork(
  networkConfig: NetworkConfig,
  logger: Logger
): Promise<void> {
  // Only works in browser environment with ethereum provider
  const ethereum = getEthereumProvider();

  if (!ethereum) {
    throw new SDKError(
      'Network switching is only supported in browser with Web3 wallet',
      'NETWORK_SWITCH_NOT_SUPPORTED'
    );
  }
  const chainIdHex = `0x${networkConfig.chainId.toString(16)}`;

  try {
    logger.info(`Requesting to switch to chain ${networkConfig.chainId} (${chainIdHex})`);

    // Try to switch to the network
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });

    logger.info(`Successfully switched to chain ${networkConfig.chainId}`);
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to MetaMask
    if (switchError.code === 4902) {
      try {
        logger.info(`Chain ${networkConfig.chainId} not found, attempting to add it...`);

        if (!networkConfig.rpcUrl) {
          throw new SDKError(
            'Cannot add network: rpcUrl is required in network config',
            'MISSING_RPC_URL',
            { networkConfig }
          );
        }

        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: chainIdHex,
              chainName: networkConfig.name || `Chain ${networkConfig.chainId}`,
              rpcUrls: [networkConfig.rpcUrl],
              nativeCurrency: networkConfig.currency || {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18,
              },
              blockExplorerUrls: networkConfig.blockExplorer
                ? [networkConfig.blockExplorer]
                : undefined,
            },
          ],
        });

        logger.info(`Successfully added and switched to chain ${networkConfig.chainId}`);
      } catch (addError) {
        logger.error('Failed to add network:', addError);
        throw new SDKError(
          `Failed to add network ${networkConfig.chainId}: ${addError}`,
          'NETWORK_ADD_ERROR',
          { networkConfig, error: addError }
        );
      }
    } else {
      logger.error('Failed to switch network:', switchError);
      throw new SDKError(
        `Failed to switch to network ${networkConfig.chainId}: ${switchError}`,
        'NETWORK_SWITCH_ERROR',
        { networkConfig, error: switchError }
      );
    }
  }
}

/**
 * Validate and auto-switch network if needed
 */
export async function ensureCorrectNetwork(
  runner: unknown,
  networkConfig: NetworkConfig | undefined,
  debug: boolean = false
): Promise<void> {
  if (!networkConfig) {
    // No network validation if config not provided
    return;
  }

  const logger = new Logger(debug);

  try {
    const isCorrect = await validateNetwork(runner, networkConfig.chainId, logger);

    if (!isCorrect) {
      logger.warn(
        `You are connected to the wrong network. Attempting to switch to chain ${networkConfig.chainId}...`
      );

      // Try to switch network (only works in browser)
      await switchNetwork(networkConfig, logger);

      // Validate again after switching
      const isCorrectAfterSwitch = await validateNetwork(
        runner,
        networkConfig.chainId,
        logger
      );

      if (!isCorrectAfterSwitch) {
        throw new SDKError(
          `Still on wrong network after switch attempt. Please manually switch to chain ${networkConfig.chainId}`,
          'WRONG_NETWORK',
          { expectedChainId: networkConfig.chainId }
        );
      }

      logger.info(`Successfully switched to correct network (chain ${networkConfig.chainId})`);
    }
  } catch (error) {
    if (error instanceof SDKError) throw error;

    logger.error('Network check failed:', error);
    throw new SDKError(
      `Network validation failed: ${error}`,
      'NETWORK_CHECK_FAILED',
      { networkConfig, error }
    );
  }
}

/**
 * Get current network info
 */
export async function getCurrentNetwork(runner: unknown): Promise<{
  chainId: number;
  name: string;
}> {
  try {
    const provider = await getProviderFromRunner(runner);
    const network = await provider.getNetwork();

    return {
      chainId: Number(network.chainId),
      name: network.name,
    };
  } catch (error) {
    throw new SDKError(
      `Failed to get current network: ${error}`,
      'GET_NETWORK_ERROR',
      { error }
    );
  }
}
