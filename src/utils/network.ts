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
export async function getProviderFromRunner(runner: Provider | Signer): Promise<Provider> {
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
  signer: Signer,
  expectedChainId: number,
  logger: Logger
): Promise<boolean> {
  try {
    const provider = await getProviderFromRunner(signer);
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
  signer: Signer,
  networkConfig: NetworkConfig,
  logger: Logger
): Promise<void> {
  const chainIdHex = `0x${networkConfig.chainId.toString(16)}`;

  try {
    // Get provider from signer
    const provider = await getProviderFromRunner(signer);

    // Check if provider supports send method (BrowserProvider in ethers v6)
    if (!provider || typeof (provider as any).send !== 'function') {
      throw new SDKError(
        'Network switching requires a provider that supports wallet RPC methods (BrowserProvider)',
        'PROVIDER_NOT_SUPPORTED'
      );
    }

    logger.info(`Requesting to switch to chain ${networkConfig.chainId} (${chainIdHex})`);

    // Try to switch to the network using provider.send()
    // This works with any EIP-1193 compatible wallet
    await (provider as any).send('wallet_switchEthereumChain', [{ chainId: chainIdHex }]);

    logger.info(`Successfully switched to chain ${networkConfig.chainId}`);
  } catch (switchError: any) {
    // Error code 4902 indicates that the chain has not been added to the wallet
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

        const provider = await getProviderFromRunner(signer);

        // Add the network to the wallet
        await (provider as any).send('wallet_addEthereumChain', [
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
        ]);

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
 * Check if provider supports wallet RPC methods (chain switching)
 * - BrowserProvider: Wraps browser wallets (MetaMask, OKX, etc.), supports wallet_* methods
 * - JsonRpcProvider: Direct RPC connection, does NOT support wallet_* methods
 */
async function canSwitchChain(signer: Signer): Promise<boolean> {
  try {
    const provider = await getProviderFromRunner(signer);

    // Check if provider has send method (required for wallet RPC calls)
    if (!provider || typeof (provider as any).send !== 'function') {
      return false;
    }

    // BrowserProvider wraps EIP-1193 providers and supports wallet methods
    // JsonRpcProvider does not support them
    const providerName = provider.constructor.name;
    return providerName === 'BrowserProvider';
  } catch {
    return false;
  }
}

/**
 * Validate and auto-switch network if needed
 *
 * Behavior depends on provider type:
 * - BrowserProvider (browser wallet): Attempts to switch chain automatically
 * - JsonRpcProvider (direct RPC): Only validates, throws clear error if mismatch
 */
export async function ensureCorrectNetwork(
  signer: Signer,
  networkConfig: NetworkConfig | undefined,
  debug: boolean = false
): Promise<void> {
  if (!networkConfig) {
    // No network validation if config not provided
    return;
  }

  const logger = new Logger(debug);

  try {
    const isCorrect = await validateNetwork(signer, networkConfig.chainId, logger);

    if (isCorrect) {
      logger.info(`Already connected to the correct network (chain ${networkConfig.chainId})`);
      return;
    }

    // Network mismatch - different handling based on provider type
    const canSwitch = await canSwitchChain(signer);

    if (canSwitch) {
      // BrowserProvider - try to switch automatically
      logger.warn(
        `Connected to wrong network. Requesting to switch to chain ${networkConfig.chainId}...`
      );

      await switchNetwork(signer, networkConfig, logger);

      // Validate again after switching
      const isCorrectAfterSwitch = await validateNetwork(signer, networkConfig.chainId, logger);

      if (!isCorrectAfterSwitch) {
        throw new SDKError(
          `Failed to switch to the correct network. Expected chain ${networkConfig.chainId}`,
          'NETWORK_SWITCH_FAILED',
          { expectedChainId: networkConfig.chainId }
        );
      }

      logger.info(`Successfully switched to chain ${networkConfig.chainId}`);
    } else {
      // JsonRpcProvider - cannot switch, throw descriptive error
      const currentNetwork = await getCurrentNetwork(signer);

      throw new SDKError(
        `Network mismatch: Connected to chain ${currentNetwork.chainId}, but operation requires chain ${networkConfig.chainId}.\n` +
          `JsonRpcProvider is connected to a fixed RPC endpoint and cannot switch chains.\n` +
          `Please create a new JsonRpcProvider/Signer with the correct RPC URL for chain ${networkConfig.chainId}.`,
        'NETWORK_MISMATCH',
        {
          currentChainId: currentNetwork.chainId,
          expectedChainId: networkConfig.chainId,
          providerType: 'JsonRpcProvider',
          suggestion: `Create provider: new ethers.JsonRpcProvider('<RPC_URL_FOR_CHAIN_${networkConfig.chainId}>')`,
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
export async function getCurrentNetwork(runner: Provider | Signer): Promise<{
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
    throw new SDKError(`Failed to get current network: ${error}`, 'GET_NETWORK_ERROR', { error });
  }
}
