import { Contract, ContractRunner, ContractTransactionResponse } from 'ethers';
import type { DDCMarketConfig, DDCNFTFactoryConfig, DeploymentResult, MintParams, NetworkConfig } from '../types';
import { SDKError } from '../types';
import { createContract, validateAddress, ensureCorrectNetwork, Logger, requireSigner } from '../utils';
import { DDCNFT_ABI, DDCNFT_FACTORY_ABI } from '../abi';

/**
 * DDCNFT Management API
 * Handles DDCNFT contract deployment and operations
 */
export class DDCNFTManager {
  private runner: ContractRunner;
  private factoryAddress?: string;
  private factoryContract?: Contract;
  private networkConfig?: NetworkConfig;
  private logger: Logger;

  // Store deployed contract addresses
  private deployedContracts: Map<string, string> = new Map();

  constructor(config: DDCMarketConfig & Partial<DDCNFTFactoryConfig>) {
    this.runner = config.runner;
    this.networkConfig = config.network;
    this.logger = new Logger(config.debug);

    this.logger.info('Initializing DDCNFTManager', {
      hasFactory: !!config.factoryAddress,
      network: config.network?.name || 'not specified',
      chainId: config.network?.chainId,
    });

    if (config.factoryAddress) {
      validateAddress(config.factoryAddress, 'Factory address');
      this.factoryAddress = config.factoryAddress;
      this.factoryContract = createContract(config.factoryAddress, DDCNFT_FACTORY_ABI, this.runner);
      this.logger.info('Factory contract initialized', { factoryAddress: config.factoryAddress });
    }
  }

  /**
   * Ensure the wallet is connected to the correct network
   * @private
   */
  private async ensureNetwork(): Promise<void> {
    if (!this.networkConfig) {
      this.logger.warn('No network config provided, skipping network validation');
      return;
    }

    try {
      await ensureCorrectNetwork(this.runner, this.networkConfig, this.logger.debug);
    } catch (error) {
      this.logger.error('Network validation failed:', error);
      throw error;
    }
  }

  /**
   * Deploy a new DDCNFT contract via factory
   * @param name - NFT collection name
   * @param symbol - NFT collection symbol
   * @returns Deployment result with contract address
   */
  async deployDDCNFT(
    name: string,
    symbol: string
  ): Promise<DeploymentResult> {
    if (!name || !name.trim()) {
      throw new SDKError(
        'Contract name cannot be empty',
        'INVALID_PARAMETER',
        { name }
      );
    }

    if (!symbol || !symbol.trim()) {
      throw new SDKError(
        'Contract symbol cannot be empty',
        'INVALID_PARAMETER',
        { symbol }
      );
    }

    if (!this.factoryContract) {
      throw new SDKError(
        'Factory contract not initialized. Please provide factoryAddress in config.',
        'FACTORY_NOT_INITIALIZED'
      );
    }

    // Verify that runner is a Signer (required for deployment)
    requireSigner(this.runner, 'deployDDCNFT');

    this.logger.info('Deploying new DDCNFT contract', { name, symbol });
    await this.ensureNetwork();

    try {
      this.logger.info('Sending deployDDCNFT transaction...');
      const tx: ContractTransactionResponse = await this.factoryContract.deployDDCNFT(name, symbol);

      this.logger.info(`Deploy transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      // Get deployed contract address from return value
      // The factory returns the address directly
      const deployedAddress = await this.factoryContract.deployDDCNFT.staticCall(name, symbol);

      // Store deployed contract address
      const contractKey = `${name}-${symbol}`;
      this.deployedContracts.set(contractKey, deployedAddress);

      this.logger.info(`DDCNFT contract deployed successfully at ${deployedAddress}`);

      return {
        contractAddress: deployedAddress,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to deploy DDCNFT:', error);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract deployment failed. Please check factory contract permissions.',
          'CONTRACT_CALL_FAILED',
          { name, symbol, originalError: error.message }
        );
      }

      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new SDKError(
          'Insufficient funds to pay for gas fees.',
          'INSUFFICIENT_FUNDS',
          { error: error.message }
        );
      }

      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        throw new SDKError(
          'Transaction was rejected by user.',
          'USER_REJECTED',
          { error: error.message }
        );
      }

      throw new SDKError(
        `Failed to deploy DDCNFT: ${error.message || error}`,
        'DEPLOYMENT_ERROR',
        { name, symbol, error: error.message || error }
      );
    }
  }

  /**
   * Get deployed contract address by name and symbol
   * @param name - NFT collection name
   * @param symbol - NFT collection symbol
   * @returns Contract address or undefined if not found
   */
  getDeployedAddress(name: string, symbol: string): string | undefined {
    const key = `${name}-${symbol}`;
    return this.deployedContracts.get(key);
  }

  /**
   * Get all deployed contract addresses
   * @returns Map of contract keys to addresses
   */
  getAllDeployedAddresses(): ReadonlyMap<string, string> {
    return this.deployedContracts;
  }

  /**
   * Get DDCNFT contract instance
   * @param contractAddress - DDCNFT contract address
   * @returns Contract instance
   */
  getDDCNFTContract(contractAddress: string): Contract {
    validateAddress(contractAddress, 'DDCNFT contract address');
    return createContract(contractAddress, DDCNFT_ABI, this.runner);
  }

  /**
   * Set base URI for DDCNFT contract
   * @param contractAddress - DDCNFT contract address
   * @param baseURI - New base URI
   * @returns Transaction hash
   */
  async setBaseURI(contractAddress: string, baseURI: string): Promise<string> {
    this.logger.info(`Setting base URI for contract ${contractAddress}`);

    // Ensure correct network before transaction
    await this.ensureNetwork();

    const contract = this.getDDCNFTContract(contractAddress);

    try {
      this.logger.info('Sending setBaseURI transaction...');
      const tx: ContractTransactionResponse = await contract.setBaseURI(baseURI);

      this.logger.info(`Transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      this.logger.info(`Base URI set successfully. Transaction: ${receipt.hash}`);
      return receipt.hash;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to set base URI:', error);

      // Enhanced error messages for common issues
      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract call failed. Please check if you have permission to set the base URI.',
          'CONTRACT_CALL_FAILED',
          { contractAddress, baseURI, originalError: error.message }
        );
      }

      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new SDKError(
          'Insufficient funds to pay for gas fees.',
          'INSUFFICIENT_FUNDS',
          { contractAddress, error: error.message }
        );
      }

      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        throw new SDKError(
          'Transaction was rejected by user.',
          'USER_REJECTED',
          { contractAddress, error: error.message }
        );
      }

      throw new SDKError(
        `Failed to set base URI: ${error.message || error}`,
        'SET_BASE_URI_ERROR',
        { contractAddress, baseURI, error: error.message || error }
      );
    }
  }

  /**
   * Mint NFT token
   * @param contractAddress - DDCNFT contract address
   * @param params - Mint parameters
   * @returns Transaction hash
   */
  async mint(contractAddress: string, params: MintParams): Promise<string> {
    this.logger.info(`Minting NFT on contract ${contractAddress}`, { tokenId: params.tokenId });

    // Ensure correct network before transaction
    await this.ensureNetwork();

    const contract = this.getDDCNFTContract(contractAddress);
    validateAddress(params.to, 'Recipient address');

    if (!params.tokenId) {
      this.logger.error('tokenId is required for minting');
      throw new SDKError('tokenId is required for minting', 'MISSING_TOKEN_ID', { params });
    }

    try {
      // Based on the ABI, mint takes (tokenId, keyHash)
      // We'll use a placeholder keyHash for now
      const keyHash = '0x0000000000000000000000000000000000000000000000000000000000000000';

      this.logger.info('Sending mint transaction...');
      const tx: ContractTransactionResponse = await contract.mint(params.tokenId, keyHash);

      this.logger.info(`Mint transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      this.logger.info(`NFT minted successfully. Transaction: ${receipt.hash}`);
      return receipt.hash;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to mint NFT:', error);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract call failed. The token may already exist or you may not have minting permission.',
          'CONTRACT_CALL_FAILED',
          { contractAddress, params, originalError: error.message }
        );
      }

      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new SDKError(
          'Insufficient funds to pay for gas fees.',
          'INSUFFICIENT_FUNDS',
          { contractAddress, error: error.message }
        );
      }

      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        throw new SDKError(
          'Transaction was rejected by user.',
          'USER_REJECTED',
          { contractAddress, error: error.message }
        );
      }

      throw new SDKError(
        `Failed to mint NFT: ${error.message || error}`,
        'MINT_ERROR',
        { contractAddress, params, error: error.message || error }
      );
    }
  }

  /**
   * Get token URI
   * @param contractAddress - DDCNFT contract address
   * @param tokenId - Token ID
   * @returns Token URI
   */
  async getTokenURI(contractAddress: string, tokenId: bigint): Promise<string> {
    const contract = this.getDDCNFTContract(contractAddress);

    try {
      return await contract.tokenURI(tokenId);
    } catch (error) {
      if (error instanceof SDKError) throw error;
      throw new SDKError(
        `Failed to get token URI: ${error}`,
        'GET_TOKEN_URI_ERROR',
        { contractAddress, tokenId, error }
      );
    }
  }

  /**
   * Transfer NFT token
   * @param contractAddress - DDCNFT contract address
   * @param from - Sender address
   * @param to - Recipient address
   * @param tokenId - Token ID
   * @returns Transaction hash
   */
  async transfer(
    contractAddress: string,
    from: string,
    to: string,
    tokenId: bigint
  ): Promise<string> {
    this.logger.info(`Transferring NFT #${tokenId} from ${from} to ${to}`);

    // Ensure correct network before transaction
    await this.ensureNetwork();

    const contract = this.getDDCNFTContract(contractAddress);
    validateAddress(from, 'From address');
    validateAddress(to, 'To address');

    try {
      this.logger.info('Sending transfer transaction...');
      const tx: ContractTransactionResponse = await contract.transferFrom(from, to, tokenId);

      this.logger.info(`Transfer transaction sent: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait();

      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      this.logger.info(`NFT transferred successfully. Transaction: ${receipt.hash}`);
      return receipt.hash;
    } catch (error: any) {
      if (error instanceof SDKError) throw error;

      this.logger.error('Failed to transfer NFT:', error);

      if (error.code === 'CALL_EXCEPTION') {
        throw new SDKError(
          'Contract call failed. You may not own this token or it may not be approved for transfer.',
          'CONTRACT_CALL_FAILED',
          { contractAddress, from, to, tokenId, originalError: error.message }
        );
      }

      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new SDKError(
          'Insufficient funds to pay for gas fees.',
          'INSUFFICIENT_FUNDS',
          { contractAddress, error: error.message }
        );
      }

      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        throw new SDKError(
          'Transaction was rejected by user.',
          'USER_REJECTED',
          { contractAddress, error: error.message }
        );
      }

      throw new SDKError(
        `Failed to transfer NFT: ${error.message || error}`,
        'TRANSFER_ERROR',
        { contractAddress, from, to, tokenId, error: error.message || error }
      );
    }
  }
}
