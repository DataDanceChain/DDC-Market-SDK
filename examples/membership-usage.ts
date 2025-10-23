/**
 * Membership Manager Usage Example
 *
 * Demonstrates all Membership contract operations with null-safe handling
 */

import { ethers } from 'ethers';
import { MembershipManager, SDKError } from '@ddc-market/sdk';

async function main() {
  // Setup
  const provider = new ethers.JsonRpcProvider('https://your-rpc-url');
  const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

  const manager = new MembershipManager({
    runner: wallet,
    network: {
      chainId: 137, // Polygon
      name: 'Polygon Mainnet',
    },
    debug: true,
  });

  const MEMBERSHIP_CONTRACT = '0xYourMembershipContractAddress';

  console.log('\n=== Membership Manager Examples ===\n');

  // ============================================
  // View Functions (Read-only)
  // ============================================

  // Example 1: Get contract info (with null checks)
  console.log('--- Example 1: Get Contract Info ---');
  try {
    const name = await manager.name(MEMBERSHIP_CONTRACT);
    const symbol = await manager.symbol(MEMBERSHIP_CONTRACT);
    const totalSupply = await manager.totalSupply(MEMBERSHIP_CONTRACT);

    if (name) {
      console.log(`Contract Name: ${name}`);
      console.log(`Contract Symbol: ${symbol}`);
      console.log(`Total Supply: ${totalSupply}`);
    } else {
      console.log('Contract does not exist or is not initialized');
    }
  } catch (error) {
    console.error('Failed to get contract info:', error);
  }

  // Example 2: Check token ownership (safe null handling)
  console.log('\n--- Example 2: Check Token Ownership ---');
  try {
    const tokenId = 1n;
    const owner = await manager.ownerOf(MEMBERSHIP_CONTRACT, tokenId);

    if (owner) {
      console.log(`Token #${tokenId} owner (hash): ${owner}`);
    } else {
      console.log(`Token #${tokenId} does not exist yet`);
    }
  } catch (error) {
    console.error('Failed to check ownership:', error);
  }

  // Example 3: Get token URI (with null fallback)
  console.log('\n--- Example 3: Get Token URI ---');
  try {
    const tokenId = 1n;
    const uri = await manager.tokenURI(MEMBERSHIP_CONTRACT, tokenId);

    if (uri) {
      console.log(`Token URI: ${uri}`);
      // Fetch metadata from URI
      // const response = await fetch(uri);
      // const metadata = await response.json();
    } else {
      console.log(`Token #${tokenId} has no URI set`);
    }
  } catch (error) {
    console.error('Failed to get token URI:', error);
  }

  // Example 4: Get contract owner
  console.log('\n--- Example 4: Get Contract Owner ---');
  try {
    const owner = await manager.getOwner(MEMBERSHIP_CONTRACT);

    if (owner) {
      console.log(`Contract Owner: ${owner}`);
    } else {
      console.log('Owner not set');
    }
  } catch (error) {
    console.error('Failed to get owner:', error);
  }

  // Example 5: Work with snapshots
  console.log('\n--- Example 5: Snapshots ---');
  try {
    const latestSnapshotId = await manager.getLatestSnapshotId(MEMBERSHIP_CONTRACT);

    if (latestSnapshotId > 0n) {
      console.log(`Latest Snapshot ID: ${latestSnapshotId}`);

      // Get members in snapshot
      const members = await manager.getMemberSnapshot(MEMBERSHIP_CONTRACT, latestSnapshotId);
      console.log(`Members in snapshot: ${members.length}`);

      if (members.length > 0) {
        console.log('First member hash:', members[0]);

        // Check if a specific member is in snapshot
        const isMember = await manager.isMemberInSnapshot(
          MEMBERSHIP_CONTRACT,
          latestSnapshotId,
          members[0]
        );
        console.log('Is member in snapshot:', isMember);
      }
    } else {
      console.log('No snapshots created yet');
    }
  } catch (error) {
    console.error('Failed to work with snapshots:', error);
  }

  // ============================================
  // State-Changing Functions (Write operations)
  // ============================================

  // Example 6: Set base URI
  console.log('\n--- Example 6: Set Base URI ---');
  try {
    const newBaseURI = 'https://api.example.com/membership/';
    const txHash = await manager.setBaseURI(MEMBERSHIP_CONTRACT, newBaseURI);

    console.log(`✓ Base URI set successfully`);
    console.log(`Transaction: ${txHash}`);
  } catch (error) {
    if (error instanceof SDKError) {
      console.log(`Error: ${error.message}`);
      if (error.code === 'CONTRACT_CALL_FAILED') {
        console.log('You may not have permission to set the base URI');
      }
    }
  }

  // Example 7: Mint membership (with error handling)
  console.log('\n--- Example 7: Mint Membership ---');
  try {
    const tokenId = 1n;
    const addressHash = ethers.keccak256(ethers.toUtf8Bytes(wallet.address.toLowerCase()));

    const txHash = await manager.mint(MEMBERSHIP_CONTRACT, tokenId, addressHash);

    console.log(`✓ Membership #${tokenId} minted successfully`);
    console.log(`Transaction: ${txHash}`);
  } catch (error) {
    if (error instanceof SDKError) {
      switch (error.code) {
        case 'CONTRACT_CALL_FAILED':
          console.log('Token may already exist or you lack minting permission');
          break;
        case 'USER_REJECTED':
          console.log('Transaction was cancelled');
          break;
        case 'INSUFFICIENT_FUNDS':
          console.log('Insufficient funds for gas');
          break;
        default:
          console.log(`Error: ${error.message}`);
      }
    }
  }

  // Example 8: Create snapshot
  console.log('\n--- Example 8: Create Snapshot ---');
  try {
    const snapshotId = await manager.createSnapshot(MEMBERSHIP_CONTRACT);

    console.log(`✓ Snapshot created successfully`);
    console.log(`Snapshot ID: ${snapshotId}`);

    // Verify snapshot
    const members = await manager.getMemberSnapshot(MEMBERSHIP_CONTRACT, snapshotId);
    console.log(`Members captured: ${members.length}`);
  } catch (error) {
    if (error instanceof SDKError) {
      console.log(`Failed to create snapshot: ${error.message}`);
    }
  }

  // Example 9: Destroy membership
  console.log('\n--- Example 9: Destroy Membership ---');
  try {
    const tokenId = 1n;
    const addressHash = ethers.keccak256(ethers.toUtf8Bytes(wallet.address.toLowerCase()));

    const txHash = await manager.destroy(MEMBERSHIP_CONTRACT, tokenId, addressHash);

    console.log(`✓ Membership #${tokenId} destroyed`);
    console.log(`Transaction: ${txHash}`);

    // Verify destruction
    const owner = await manager.ownerOf(MEMBERSHIP_CONTRACT, tokenId);
    console.log(`Token owner after destruction: ${owner || 'null (destroyed)'}`);
  } catch (error) {
    if (error instanceof SDKError) {
      console.log(`Failed to destroy: ${error.message}`);
    }
  }

  // Example 10: Transfer ownership
  console.log('\n--- Example 10: Transfer Contract Ownership ---');
  try {
    const newOwner = '0xNewOwnerAddress';
    const txHash = await manager.transferOwnership(MEMBERSHIP_CONTRACT, newOwner);

    console.log(`✓ Ownership transferred to ${newOwner}`);
    console.log(`Transaction: ${txHash}`);

    // Verify new owner
    const owner = await manager.getOwner(MEMBERSHIP_CONTRACT);
    console.log(`New contract owner: ${owner}`);
  } catch (error) {
    if (error instanceof SDKError) {
      if (error.code === 'CONTRACT_CALL_FAILED') {
        console.log('You are not the current owner');
      } else {
        console.log(`Error: ${error.message}`);
      }
    }
  }

  // ============================================
  // Advanced: Batch Operations
  // ============================================

  console.log('\n--- Example 11: Batch Check Members ---');
  try {
    const tokenIds = [1n, 2n, 3n, 4n, 5n];
    const results = await Promise.allSettled(
      tokenIds.map((tokenId) => manager.ownerOf(MEMBERSHIP_CONTRACT, tokenId))
    );

    console.log('Membership Status:');
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const owner = result.value;
        console.log(`  Token #${tokenIds[index]}: ${owner ? 'Minted' : 'Not minted'}`);
      } else {
        console.log(`  Token #${tokenIds[index]}: Error checking`);
      }
    });
  } catch (error) {
    console.error('Failed batch check:', error);
  }

  // ============================================
  // Best Practices
  // ============================================

  console.log('\n--- Example 12: Best Practices ---');

  // Always check if contract exists before operations
  const contractName = await manager.name(MEMBERSHIP_CONTRACT);
  if (!contractName) {
    console.log('⚠️ Contract not found or not initialized');
    console.log('Skipping operations...');
    return;
  }

  // Check token existence before operations
  const tokenId = 999n;
  const owner = await manager.ownerOf(MEMBERSHIP_CONTRACT, tokenId);
  if (!owner) {
    console.log(`⚠️ Token #${tokenId} does not exist`);
    console.log('Cannot perform operations on non-existent token');
    return;
  }

  console.log('✓ All checks passed, safe to proceed with operations');
}

// Run examples
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ All examples completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}

export { main };
