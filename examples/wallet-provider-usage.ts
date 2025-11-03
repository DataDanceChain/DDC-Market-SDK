/**
 * Wallet Provider Usage Examples
 *
 * Demonstrates how to use getProvider() and getSigner() with different wallet types:
 * 1. MetaMask and standard browser wallets (window.ethereum)
 * 2. Web3Auth Embedded Wallets (MetaMask Embedded Wallets SDK)
 */

import { getSigner } from '../src/utils/wallet';

// ============================================================================
// Scenario 1: MetaMask or Standard Browser Wallets
// ============================================================================

/**
 * Example: Using MetaMask (auto-detected from window.ethereum)
 */
// async function useMetaMask() {
//   try {
//     // Get provider - automatically detects window.ethereum
//     const provider = await getProvider();

//     // Get network info
//     const network = await provider.getNetwork();
//     console.log('Connected to network:', network.name, 'Chain ID:', network.chainId);

//     // Get signer (will request account access if not already granted)
//     const signer = await getSigner();
//     const address = await signer.getAddress();
//     console.log('Connected wallet address:', address);

//     // Check balance
//     const balance = await provider.getBalance(address);
//     console.log('Balance:', balance.toString());
//   } catch (error) {
//     console.error('MetaMask connection error:', error);
//   }
// }

// ============================================================================
// Scenario 2: Web3Auth Embedded Wallets
// ============================================================================

/**
 * Example: Using Web3Auth (MetaMask Embedded Wallets SDK)
 * Requires: npm install @web3auth/modal
 */
async function useWeb3Auth() {
  // Note: This requires @web3auth/modal package to be installed
  // You would import it like this:
  // import { Web3Auth, WEB3AUTH_NETWORK } from '@web3auth/modal';

  try {
    // Step 1: Create and initialize Web3Auth instance
    // Uncomment when using in a real project:
    /*
    const web3auth = new Web3Auth({
      clientId: 'YOUR_WEB3AUTH_CLIENT_ID', // Get from https://dashboard.web3auth.io
      web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
      chainConfig: {
        chainNamespace: 'eip155',
        chainId: '0x1', // Ethereum Mainnet
        rpcTarget: 'https://rpc.ankr.com/eth',
      },
    });

    await web3auth.init();
    console.log('Web3Auth initialized');

    // Step 2: Connect (triggers authentication UI - social login, email, etc.)
    await web3auth.connect();
    console.log('Web3Auth connected');

    // Step 3: Get provider using the Web3Auth instance
    const provider = await getProvider({ web3auth });

    // Get network info
    const network = await provider.getNetwork();
    console.log('Connected to network:', network.name, 'Chain ID:', network.chainId);

    // Step 4: Get signer (accounts already connected after web3auth.connect())
    const signer = await getSigner({ web3auth });
    const address = await signer.getAddress();
    console.log('Connected wallet address:', address);

    // Get user info from Web3Auth
    if (web3auth.provider?.user) {
      console.log('User info:', web3auth.provider.user);
    }

    // Check balance
    const balance = await provider.getBalance(address);
    console.log('Balance:', balance.toString());

    // Step 5: Disconnect when done
    await web3auth.logout();
    console.log('Web3Auth disconnected');
    */

    console.log('Uncomment the Web3Auth code above to use this example');
  } catch (error) {
    console.error('Web3Auth connection error:', error);
  }
}

// ============================================================================
// Scenario 3: Web3Auth via Global Window Object
// ============================================================================

/**
 * Example: Using Web3Auth from global window.web3auth
 * Assumes Web3Auth is already initialized and connected elsewhere in your app
 */
// async function useWeb3AuthFromWindow() {
//   try {
//     // Check if Web3Auth is available on window
//     if (!window.web3auth?.provider) {
//       throw new Error('Web3Auth not found. Please initialize and connect first.');
//     }

//     // Get provider - automatically detects window.web3auth.provider
//     const provider = await getProvider();

//     // Get signer
//     const signer = await getSigner();
//     const address = await signer.getAddress();
//     console.log('Connected wallet address:', address);
//   } catch (error) {
//     console.error('Web3Auth (window) connection error:', error);
//   }
// }

// ============================================================================
// Scenario 4: Sending a Transaction
// ============================================================================

/**
 * Example: Send transaction with either MetaMask or Web3Auth
 */
// async function sendTransaction(recipientAddress: string, amountInEther: string) {
//   try {
//     // Works with both MetaMask and Web3Auth
//     // For Web3Auth, pass { web3auth } option
//     const signer = await getSigner();

//     const tx = await signer.sendTransaction({
//       to: recipientAddress,
//       value: ethers.parseEther(amountInEther),
//     });

//     console.log('Transaction sent:', tx.hash);

//     // Wait for confirmation
//     const receipt = await tx.wait();
//     console.log('Transaction confirmed in block:', receipt?.blockNumber);

//     return receipt;
//   } catch (error) {
//     console.error('Transaction error:', error);
//     throw error;
//   }
// }

// ============================================================================
// Type-safe Usage with Web3Auth Types
// ============================================================================

/**
 * Example: Type-safe Web3Auth integration
 */
async function typeSafeWeb3Auth() {
  // Import Web3AuthInstance type for type safety
  // import type { Web3AuthInstance } from '../src/types';
  /*
  // Create Web3Auth instance with proper typing
  const web3auth: Web3AuthInstance = new Web3Auth({
    clientId: 'YOUR_CLIENT_ID',
    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
  });

  await web3auth.init();
  await web3auth.connect();

  // TypeScript will properly check the web3auth instance
  const provider = await getProvider({ web3auth });
  const signer = await getSigner({ web3auth });

  // Access user info with type safety
  if (web3auth.provider?.user) {
    const email = web3auth.provider.user.email;
    const name = web3auth.provider.user.name;
    console.log(`Logged in as ${name} (${email})`);
  }
  */
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Example: Proper error handling for both scenarios
 */
// async function handleErrors() {
//   try {
//     const provider = await getProvider();
//     const signer = await getSigner();
//     // ... use provider and signer
//   } catch (error) {
//     if (error instanceof Error) {
//       if (error.message.includes('No wallet provider found')) {
//         console.error('No wallet detected. Please install MetaMask or connect Web3Auth');
//         // Show UI to guide user to install wallet or connect Web3Auth
//       } else if (error.message.includes('User rejected')) {
//         console.error('User rejected the connection request');
//         // Show UI message to user
//       } else if (error.message.includes('browser environment')) {
//         console.error('This code must run in a browser');
//       } else {
//         console.error('Unexpected error:', error.message);
//       }
//     }
//   }
// }

// Export examples for testing
export // useMetaMask,
// useWeb3Auth,
// // useWeb3AuthFromWindow,
// sendTransaction,
// typeSafeWeb3Auth,
// handleErrors,
 {};

// Note: Import ethers for the sendTransaction example
import { ethers } from 'ethers';
