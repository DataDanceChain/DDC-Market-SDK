import { BrowserProvider, JsonRpcProvider } from 'ethers';
import { SDKError, type Web3AuthInstance } from '../types';

/**
 * Get BrowserProvider from browser environment
 *
 * Supports two main scenarios:
 *
 * **Scenario 1: Standard EVM wallet injected providers**
 * - MetaMask, WalletConnect, Coinbase Wallet, etc.
 * - Uses `window.ethereum` or other injected wallet objects
 * - Provider is automatically detected from browser window object
 *
 * **Scenario 2: Web3Auth Embedded Wallets (MetaMask Embedded Wallets SDK)**
 * - Provides EIP-1193 compatible provider via Web3Auth SDK
 * - Pass the Web3Auth instance via options: `getProvider({ web3auth })`
 * - Or use global `window.web3auth` instance if available
 * - Compatible with ethers.js and web3.js for JSON-RPC requests
 *
 * @example
 * ```typescript
 * // Scenario 1: MetaMask or injected wallet (auto-detect)
 * const provider = await getProvider();
 * const signer = await provider.getSigner();
 *
 * // Scenario 2: Web3Auth embedded wallet (pass instance)
 * import { Web3Auth } from '@web3auth/modal';
 * const web3auth = new Web3Auth({ clientId: 'YOUR_CLIENT_ID' });
 * await web3auth.init();
 * await web3auth.connect();
 * const provider = await getProvider({ web3auth });
 
 * ```
 */
export const getProvider = async (): Promise<BrowserProvider> => {
  if (window.ethereum) {
    return new BrowserProvider(window.ethereum);
  }

  // Priority 4: Check for WalletConnect provider
  if (window.walletConnect) {
    return new BrowserProvider(window.walletConnect);
  }

  // Priority 5: Check for Coinbase Wallet
  if (window.coinbaseWalletExtension) {
    return new BrowserProvider(window.coinbaseWalletExtension);
  }

  throw new Error(
    'No wallet provider found. Please:\n' +
      '  1. Install a browser wallet (MetaMask, Coinbase Wallet, etc.), or\n' +
      '  2. Initialize and connect Web3Auth, then pass the instance: getProvider({ web3auth })'
  );
};

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
