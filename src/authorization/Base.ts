import {
  Contract,
  ContractTransactionResponse,
  ContractTransactionReceipt,
  Provider,
  BrowserProvider,
  JsonRpcProvider,
  Interface,
  Signer,
} from 'ethers';
import {
  resolveProvider,
  getSigner,
  ensureCorrectNetwork,
  resolveWalletAddress,
  Logger,
  validateAddress,
} from '../utils';
import {
  MerchantInfo,
  MerchantConfig,
  MerchantParams,
  UserAuthOptions,
  UserAuthResult,
  RevokeUserAuthResult,
  UserAuthorizationInfo,
} from '../types/auth';
import type { DDCChainConfig, SignerConfig } from '../types';

class Base {
  protected provider?: Provider;
  protected networkConfig?: DDCChainConfig;
  protected signerConfig?: SignerConfig;

  protected logger: Logger;

  protected static instance: Base | null = null;

  constructor(config: MerchantConfig) {
    this.logger = new Logger(config?.debug || false);
  }

  /**
   * Ensure connected to correct network
   * @protected
   */
  async ensureNetwork(): Promise<void> {
    if (!this.networkConfig) {
      this.logger.warn('No network config provided, skipping network validation');
      return;
    }

    if (!this.provider) {
      this.logger.warn('No provider available, skipping network validation');
      return;
    }

    try {
      if (this.provider instanceof BrowserProvider) {
        await ensureCorrectNetwork(this.provider, this.networkConfig, this.logger.debug);
      } else if (this.provider instanceof JsonRpcProvider) {
        this.logger.info(
          `JsonRpcProvider network trusted: chainId ${this.networkConfig.chain_id} (SDK constructed)`
        );
      } else {
        try {
          const network = await this.provider.getNetwork();
          const expectedChainId = BigInt(this.networkConfig.chain_id);
          if (network.chainId !== expectedChainId) {
            this.logger.warn(
              `Network mismatch: Connected to chain ${network.chainId}, expected ${expectedChainId}`
            );
          } else {
            this.logger.info(`Network validated: chainId ${network.chainId}`);
          }
        } catch (networkError) {
          this.logger.warn(
            `Could not validate network via getNetwork(), continuing with networkConfig chainId ${this.networkConfig.chain_id}`,
            networkError
          );
        }
      }
    } catch (error) {
      this.logger.error('Network validation failed:', error);
      throw error;
    }
  }
}

export default Base;
