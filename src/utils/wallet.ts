import { BrowserProvider, JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';
import { SDKError } from '../types';

/**
 * Get signer from browser environment
 * Requires user to be connected to a wallet
 *
 * @param options - Optional configuration (same as getProvider)
 * @param options.web3auth - Web3Auth SDK instance for embedded wallets
 * @returns ethers.js Signer instance for signing transactions
 * @throws {Error} If no wallet provider is found or user rejects account access
 *
 * @example
 * ```typescript
 * // With MetaMask or injected wallet
 * const signer = await getSigner();
 * const address = await signer.getAddress();
 *
 * // With Web3Auth
 * const signer = await getSigner({ web3auth });
 * const tx = await signer.sendTransaction({ to: '0x...', value: ethers.parseEther('0.1') });
 * ```
 */
export const getSigner = async (provider: BrowserProvider | JsonRpcProvider) => {
  if (!provider) {
    throw new SDKError('Provider is required', 'INVALID_PARAMETER', { provider });
  }

  return await provider.getSigner();
};

/**
 * Generate a bytes32 hash from a key string
 * This is commonly used for NFT operations (mint, transfer, destroy)
 *
 * @param key - The key string to hash (e.g., user's private key or secret)
 * @returns A bytes32 hash (0x + 64 hex characters) generated using keccak256
 * @throws {SDKError} If key is empty or invalid
 *
 * @example
 * ```typescript
 * import { generateKeyHash } from '@ddc-market/sdk';
 *
 * // Generate keyHash for minting
 * const userKey = 'user_secret_key_123';
 * const keyHash = generateKeyHash(userKey);
 * // keyHash = '0x...' (64 hex characters)
 *
 * // Use with DDCNFTManager
 * await ddcnftManager.mint(1n, keyHash);
 *
 * // Generate recipient hash for transfer
 * const recipientKey = 'recipient_secret_key_456';
 * const recipientHash = generateKeyHash(recipientKey);
 * await ddcnftManager.transfer(recipientHash, 1n, userKey);
 * ```
 */
export const getKeyHash = (key: string): string => {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    throw new SDKError('Key must be a non-empty string', 'INVALID_PARAMETER', { key });
  }

  try {
    // Convert string to UTF-8 bytes and compute keccak256 hash
    const hash = keccak256(toUtf8Bytes(key));
    return hash;
  } catch (error: any) {
    throw new SDKError(
      `Failed to generate key hash: ${error.message || error}`,
      'KEY_HASH_GENERATION_ERROR',
      { key, error: error.message || error }
    );
  }
};
