import { Provider, JsonRpcProvider, BrowserProvider, Signer } from 'ethers';
import type { DDCChainConfig } from '../types';
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
export async function getProviderFromRunner(runner: Provider): Promise<Provider> {
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
  provider: Provider,
  expectedChainId: number,
  logger: Logger
): Promise<boolean> {
  try {
    const network = await provider.getNetwork();
    const currentChainId = Number(network.chainId);

    logger.info(`Current chain ID: ${currentChainId}, Expected: ${expectedChainId}`);

    if (currentChainId !== expectedChainId) {
      logger.warn(`Network mismatch! Current: ${currentChainId}, Expected: ${expectedChainId}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Failed to validate network:', error);
    throw new SDKError(`Failed to validate network: ${error}`, 'NETWORK_VALIDATION_ERROR', {
      expectedChainId,
      error,
    });
  }
}

/**
 * Switch network using Signer's provider (works with any EIP-1193 compatible wallet)
 * This approach works with MetaMask, OKX, WalletConnect, Web3Auth, and other wallets
 *
 * @param signer - Ethers Signer instance (already connected to wallet)
 * @param networkConfig - Network configuration
 * @param logger - Logger instance
 */
export async function switchNetwork(
  provider: Provider,
  networkConfig: DDCChainConfig,
  logger: Logger
): Promise<void> {
  const chainIdHex = `0x${networkConfig.chain_id.toString(16)}`;

  try {
    // // Check if provider supports send method (BrowserProvider in ethers v6)
    // if (!provider || typeof (provider as any)?.send !== 'function') {
    //   throw new SDKError(
    //     'Network switching requires a provider that supports wallet RPC methods (BrowserProvider)',
    //     'PROVIDER_NOT_SUPPORTED'
    //   );
    // }

    logger.info(`Requesting to switch to chain ${networkConfig.chain_id} (${chainIdHex})`);

    // Try to switch to the network using provider.send()
    // This works with any EIP-1193 compatible wallet
    await (provider as any).send('wallet_switchEthereumChain', [{ chainId: chainIdHex }]);

    logger.info(`Successfully switched to chain ${networkConfig.chain_id}`);
  } catch (switchError: any) {
    // Error code 4902 indicates that the chain has not been added to the wallet
    if (switchError.code === 4902) {
      try {
        logger.info(`Chain ${networkConfig.chain_id} not found, attempting to add it...`);

        if (!networkConfig.rpc_url) {
          throw new SDKError(
            'Cannot add network: rpcUrl is required in network config',
            'MISSING_RPC_URL',
            { networkConfig }
          );
        }

        // Add the network to the wallet
        await (provider as any).send('wallet_addEthereumChain', [
          {
            chainId: chainIdHex,
            chainName: networkConfig.chain_name || `Chain ${networkConfig.chain_id}`,
            rpcUrls: [networkConfig.rpc_url],
            nativeCurrency: networkConfig.token_symbol,
            // blockExplorerUrls: networkConfig.blockExplorer
            //   ? [networkConfig.blockExplorer]
            //   : undefined,
          },
        ]);

        logger.info(`Successfully added and switched to chain ${networkConfig.chain_id}`);
      } catch (addError) {
        logger.error('Failed to add network:', addError);
        throw new SDKError(
          `Failed to add network ${networkConfig.chain_id}: ${addError}`,
          'NETWORK_ADD_ERROR',
          { networkConfig, error: addError }
        );
      }
    } else {
      logger.error('Failed to switch network:', switchError);
      throw new SDKError(
        `Failed to switch to network ${networkConfig.chain_id}: ${switchError}`,
        'NETWORK_SWITCH_ERROR',
        { networkConfig, error: switchError }
      );
    }
  }
}

/**
 * Check if provider supports wallet RPC methods (chain switching)
 * 
 * Provider types:
 * 1. BrowserProvider: Wraps browser wallets (MetaMask, OKX, etc.)
 *    - Has internal EIP-1193 provider (window.ethereum)
 *    - Supports wallet_switchEthereumChain and wallet_addEthereumChain
 * 
 * 2. JsonRpcProvider: Direct RPC connection to node
 *    - No wallet capabilities
 *    - Cannot switch chains (would need to reconnect with different RPC URL)
 * 
 * @param provider - The ethers Provider to check
 * @returns true if provider supports chain switching (is a BrowserProvider with wallet), false otherwise
 */
async function canSwitchChain(provider: BrowserProvider): Promise<boolean> {
  // try {
  //   if (!provider) {
  //     return false;
  //   }

    // const providerAny = provider as any;
    // Check 1: Must have a wrapped EIP-1193 provider
    // BrowserProvider wraps window.ethereum (or similar) in providerAny.provider
    // JsonRpcProvider doesn't have this structure
    // if (!providerAny.provider) {
    //   return false;
    // }

    // const eip1193Provider = providerAny.provider;

    // Check 2: The wrapped provider must implement EIP-1193 request method
    // This is the standard interface for browser wallets
    if (typeof provider?.send === 'function' ) {
      return true;
    }

  //   // return false;
  // } catch (error) {
  //   // If any error occurs during detection, assume cannot switch
  //   return false;
  // }
  return false;
}

/**
 * Validate and auto-switch network if needed
 *
 * Behavior depends on provider type:
 * - BrowserProvider (browser wallet): Attempts to switch chain automatically
 * - JsonRpcProvider (direct RPC): Only validates, throws clear error if mismatch
 */
export async function ensureCorrectNetwork(
  provider: BrowserProvider,
  networkConfig: DDCChainConfig | undefined,
  debug: boolean = false
): Promise<void> {
  if (!networkConfig) {
    // No network validation if config not provided
    return;
  }

  const logger = new Logger(debug);

  try {
    const isCorrect = await validateNetwork(provider, networkConfig.chain_id, logger);

    if (isCorrect) {
      logger.info(`Already connected to the correct network (chain ${networkConfig.chain_id})`);
      return;
    }

    // Network mismatch - different handling based on provider type
    const canSwitch = await canSwitchChain(provider);

    if (canSwitch) {
      // BrowserProvider - try to switch automatically
      logger.warn(
        `Connected to wrong network. Requesting to switch to chain ${networkConfig.chain_id}...`
      );

      await switchNetwork(provider, networkConfig, logger);

      // Validate again after switching
      const isCorrectAfterSwitch = await validateNetwork(provider, networkConfig.chain_id, logger);

      if (!isCorrectAfterSwitch) {
        throw new SDKError(
          `Failed to switch to the correct network. Expected chain ${networkConfig.chain_id}`,
          'NETWORK_SWITCH_FAILED',
          { expectedChainId: networkConfig.chain_id }
        );
      }

      logger.info(`Successfully switched to chain ${networkConfig.chain_id}`);
    } else {
      // JsonRpcProvider - cannot switch, throw descriptive error
      const currentNetwork = await getCurrentNetwork(provider);

      throw new SDKError(
        `Network mismatch: Connected to chain ${currentNetwork.chainId}, but operation requires chain ${networkConfig.chain_id}.\n` +
          `JsonRpcProvider is connected to a fixed RPC endpoint and cannot switch chains.\n` +
          `Please create a new JsonRpcProvider/Signer with the correct RPC URL for chain ${networkConfig.chain_id}.`,
        'NETWORK_MISMATCH',
        {
          currentChainId: currentNetwork.chainId,
          expectedChainId: networkConfig.chain_id,
          providerType: 'JsonRpcProvider',
          suggestion: `Create provider: new ethers.JsonRpcProvider('<RPC_URL_FOR_CHAIN_${networkConfig.chain_id}>')`,
        }
      );
    }
  } catch (error) {
    // Re-throw SDKError as-is (already has clear message)
    if (error instanceof SDKError) {
      throw error;
    }

    // Wrap other errors
    logger.error('Network validation failed:', error);
    throw new SDKError(`Network validation failed: ${error}`, 'NETWORK_CHECK_FAILED', {
      networkConfig,
      error,
    });
  }
}

/**
 * Get current network info
 */
export async function getCurrentNetwork(provider: Provider): Promise<{
  chainId: number;
  name: string;
}> {
  try {
    const network = await provider.getNetwork();

    return {
      chainId: Number(network.chainId),
      name: network.name,
    };
  } catch (error) {
    throw new SDKError(`Failed to get current network: ${error}`, 'GET_NETWORK_ERROR', { error });
  }
}
