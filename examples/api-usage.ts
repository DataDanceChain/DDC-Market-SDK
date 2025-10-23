/**
 * API Usage Examples
 *
 * This file demonstrates how to use the auto-generated API functions
 * All API functions are now in a single file: src/service/api/api.ts
 */

import {
  getDDCConfig,
  setNFTPrivateKey,
  getNFTPrivateKey,
  setRecipientKey,
  getNftRecipientKey,
} from '../src/service/api';

/**
 * Example 1: Get DDC Configuration
 */
async function getConfiguration() {
  // Optional: provide wallet address
  const response = await getDDCConfig({
    address: '0x1234567890123456789012345678901234567890',
  });

  if (response.success) {
    console.log('Configuration:', response.data);
    console.log('NFT Factory Address:', response.data.nft_factory_address);
    console.log('Membership Factory Address:', response.data.membership_factory_address);
    console.log('Network:', response.data.network);
  } else {
    console.error('Failed to get configuration:', response.error);
  }
}

/**
 * Example 2: Set NFT Private Key
 */
async function setNftPrivateKey() {
  const response = await setNFTPrivateKey({
    address: '0x1234567890123456789012345678901234567890',
    private_key: 'your-private-key-here',
  });

  if (response.success) {
    console.log('Private key set successfully:', response.data);
  } else {
    console.error('Failed to set private key:', response.error);
  }
}

/**
 * Example 3: Get NFT Private Key
 */
async function getNftPrivateKey() {
  const response = await getNFTPrivateKey({
    address: '0x1234567890123456789012345678901234567890',
  });

  if (response.success) {
    console.log('Private key:', response.data.data.result);
  } else {
    console.error('Failed to get private key:', response.error);
  }
}

/**
 * Example 4: Set Recipient Key
 */
async function setRecipientKey() {
  const response = await setRecipientKey({
    address: '0x1234567890123456789012345678901234567890',
    recipient_key: 'your-recipient-key-here',
  });

  if (response.success) {
    console.log('Recipient key set successfully:', response.data);
  } else {
    console.error('Failed to set recipient key:', response.error);
  }
}

/**
 * Example 5: Get NFT Recipient Key
 */
async function getNftRecipientKey() {
  const response = await getNftRecipientKey({
    address: '0x1234567890123456789012345678901234567890',
  });

  if (response.success) {
    console.log('Recipient key:', response.data.data.result);
  } else {
    console.error('Failed to get recipient key:', response.error);
  }
}

/**
 * Example 6: Complete workflow
 */
async function completeWorkflow() {
  try {
    // Step 1: Get configuration
    console.log('Step 1: Getting configuration...');
    const configResponse = await getDDCConfig({});

    if (!configResponse.success) {
      throw new Error('Failed to get configuration');
    }

    const walletAddress = '0x1234567890123456789012345678901234567890';

    // Step 2: Set NFT private key
    console.log('Step 2: Setting NFT private key...');
    const setKeyResponse = await setNFTPrivateKey({
      address: walletAddress,
      private_key: 'random-generated-key',
    });

    if (!setKeyResponse.success) {
      throw new Error('Failed to set private key');
    }

    // Step 3: Retrieve the private key
    console.log('Step 3: Retrieving NFT private key...');
    const getKeyResponse = await getNFTPrivateKey({
      address: walletAddress,
    });

    if (!getKeyResponse.success) {
      throw new Error('Failed to get private key');
    }

    console.log('Workflow completed successfully!');
    console.log('Private key:', getKeyResponse.data.data.result);
  } catch (error) {
    console.error('Workflow failed:', error);
  }
}

// Export examples for use in other files
export {
  getConfiguration,
  setNftPrivateKey,
  getNftPrivateKey,
  setRecipientKey,
  getNftRecipientKey,
  completeWorkflow,
};
