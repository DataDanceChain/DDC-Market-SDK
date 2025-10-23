/**
 * Network Handling Example
 *
 * This example demonstrates:
 * - Network validation and auto-switching
 * - Error handling for different wallet scenarios
 * - Debug logging
 */

import { ethers } from 'ethers';
import { DDCNFTManager, NetworkConfig, SDKError } from '@ddc-market/sdk';

// Example: Polygon Network Configuration
const POLYGON_NETWORK: NetworkConfig = {
  chainId: 137,
  name: 'Polygon Mainnet',
  rpcUrl: 'https://polygon-rpc.com',
  blockExplorer: 'https://polygonscan.com',
  currency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
};

async function main() {
  try {
    // === Scenario 1: Browser Environment with MetaMask ===
    console.log('\n=== Scenario 1: Browser with MetaMask ===');

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      // SDK will automatically check network and prompt user to switch if needed
      const manager = new DDCNFTManager({
        runner: signer,
        network: POLYGON_NETWORK,
        debug: true, // Enable debug logging
      });

      console.log('✓ DDCNFTManager initialized with network validation');

      // Try to mint - SDK will ensure correct network before transaction
      try {
        const txHash = await manager.mint('0xYourNFTContract', {
          to: await signer.getAddress(),
          tokenId: 1n,
        });
        console.log('✓ NFT minted:', txHash);
      } catch (error) {
        if (error instanceof SDKError) {
          console.log(`Error Code: ${error.code}`);
          console.log(`Error Message: ${error.message}`);

          // Handle specific errors
          switch (error.code) {
            case 'WRONG_NETWORK':
              console.log('User needs to manually switch network');
              break;
            case 'USER_REJECTED':
              console.log('User rejected the transaction');
              break;
            case 'INSUFFICIENT_FUNDS':
              console.log('User does not have enough funds for gas');
              break;
            default:
              console.log('Other error occurred');
          }
        }
      }
    }

    // === Scenario 2: Node.js Environment ===
    console.log('\n=== Scenario 2: Node.js Environment ===');

    const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
    const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

    const manager = new DDCNFTManager({
      runner: wallet,
      network: POLYGON_NETWORK,
      debug: true,
    });

    console.log('✓ DDCNFTManager initialized for Node.js');

    // === Scenario 3: Handling Wrong Network ===
    console.log('\n=== Scenario 3: Detecting Wrong Network ===');

    try {
      // Try to use manager when connected to wrong network
      const txHash = await manager.setBaseURI(
        '0xYourNFTContract',
        'https://api.example.com/metadata/'
      );
      console.log('✓ Base URI set:', txHash);
    } catch (error) {
      if (error instanceof SDKError) {
        if (error.code === 'WRONG_NETWORK') {
          console.log('❌ Connected to wrong network!');
          console.log('Expected chain ID:', POLYGON_NETWORK.chainId);
          console.log('In browser, SDK would prompt user to switch');
          console.log('In Node.js, please connect to correct RPC');
        }
      }
    }

    // === Scenario 4: Common Error Handling ===
    console.log('\n=== Scenario 4: Comprehensive Error Handling ===');

    try {
      await manager.mint('0xYourNFTContract', {
        to: wallet.address,
        tokenId: 1n,
      });
    } catch (error) {
      if (error instanceof SDKError) {
        console.log('\n🔴 Error occurred:');
        console.log('Code:', error.code);
        console.log('Message:', error.message);

        // Get detailed error information
        if (error.data) {
          console.log('Details:', JSON.stringify(error.data, null, 2));
        }

        // User-friendly error messages
        const userMessages: Record<string, string> = {
          WRONG_NETWORK: 'Please switch to the correct network in your wallet',
          USER_REJECTED: 'You cancelled the transaction',
          INSUFFICIENT_FUNDS: 'You don\'t have enough funds to complete this transaction',
          CONTRACT_CALL_FAILED:
            'The contract call failed. You may not have permission to perform this action',
          NETWORK_VALIDATION_ERROR: 'Could not validate your network connection',
          INVALID_ADDRESS: 'The provided address is not valid',
        };

        const userMessage =
          userMessages[error.code] || 'An unexpected error occurred';
        console.log('\n💡 User-friendly message:', userMessage);
      } else {
        console.error('Unexpected error:', error);
      }
    }

    // === Scenario 5: Getting Current Network Info ===
    console.log('\n=== Scenario 5: Current Network Info ===');

    const { getCurrentNetwork } = await import('@ddc-market/sdk');

    try {
      const currentNetwork = await getCurrentNetwork(wallet);
      console.log('Current Network:');
      console.log('  Chain ID:', currentNetwork.chainId);
      console.log('  Name:', currentNetwork.name);
    } catch (error) {
      console.error('Failed to get network info:', error);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the examples
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Examples completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

export { main };
