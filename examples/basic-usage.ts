/**
 * Basic usage example for DDC Market SDK
 *
 * This example demonstrates how to use the SDK for DDCNFT and Membership management
 */

import { ethers } from 'ethers';
import { DDCNFTManager, MembershipManager } from '@ddc-market/sdk';

async function main() {
  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider('https://your-rpc-url');
  const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

  console.log('Wallet address:', wallet.address);

  // Initialize managers
  const ddcnftManager = new DDCNFTManager({
    runner: wallet,
    factoryAddress: '0xYourDDCNFTFactoryAddress',
  });

  const membershipManager = new MembershipManager({
    runner: wallet,
    factoryAddress: '0xYourMembershipFactoryAddress',
  });

  // Example 1: Deploy DDCNFT Contract
  console.log('\n--- Deploying DDCNFT Contract ---');
  try {
    const ddcnftDeployment = await ddcnftManager.deployDDCNFT(
      'My NFT Collection',
      'MNFT',
      'https://api.mydapp.com/metadata/'
    );
    console.log('DDCNFT deployed at:', ddcnftDeployment.contractAddress);
  } catch (error) {
    console.error('Failed to deploy DDCNFT:', error);
  }

  // Example 2: Mint NFT
  console.log('\n--- Minting NFT ---');
  try {
    const mintTx = await ddcnftManager.mint('0xYourNFTContractAddress', {
      to: wallet.address,
      tokenId: 1n,
      metadata: {
        name: 'Genesis NFT',
        description: 'The first NFT in our collection',
        image: 'https://mydapp.com/images/genesis.png',
        attributes: [
          { trait_type: 'Generation', value: 'Genesis' },
          { trait_type: 'Rarity', value: 'Legendary' },
        ],
      },
    });
    console.log('NFT minted, tx:', mintTx);
  } catch (error) {
    console.error('Failed to mint NFT:', error);
  }

  // Example 3: Deploy Membership Contract
  console.log('\n--- Deploying Membership Contract ---');
  try {
    const membershipDeployment = await membershipManager.deployMembership(
      'Premium Membership',
      'PMEM'
    );
    console.log('Membership deployed at:', membershipDeployment.contractAddress);
  } catch (error) {
    console.error('Failed to deploy Membership:', error);
  }

  // Example 4: Set Membership Tier
  console.log('\n--- Setting Membership Tier ---');
  try {
    await membershipManager.setMembershipTier('0xYourMembershipContractAddress', {
      tierId: 1,
      name: 'Gold Tier',
      price: ethers.parseEther('0.1'),
      duration: 365 * 24 * 60 * 60, // 1 year
      benefits: ['Priority support', 'Exclusive content', '10% discount'],
    });
    console.log('Membership tier set successfully');
  } catch (error) {
    console.error('Failed to set membership tier:', error);
  }

  // Example 5: Verify Membership
  console.log('\n--- Verifying Membership ---');
  try {
    const isActive = await membershipManager.verifyMembership(
      '0xYourMembershipContractAddress',
      wallet.address
    );
    console.log('Membership active:', isActive);

    if (isActive) {
      const details = await membershipManager.getMembershipDetails(
        '0xYourMembershipContractAddress',
        wallet.address
      );
      console.log('Membership details:', {
        tierId: details.tierId,
        expiresAt: new Date(Number(details.expiresAt) * 1000).toISOString(),
        isActive: details.isActive,
      });
    }
  } catch (error) {
    console.error('Failed to verify membership:', error);
  }
}

// Run the example
main()
  .then(() => {
    console.log('\n✓ Examples completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Error:', error);
    process.exit(1);
  });
