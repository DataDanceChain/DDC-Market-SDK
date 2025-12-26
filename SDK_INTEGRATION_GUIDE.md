# DDC Market SDK Integration Guide

> This guide is designed for helping you quickly get started with DDC Market SDK without deep understanding of blockchain technical details.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [DDCNFT Complete Workflow](#ddcnft-complete-workflow)
- [Membership Complete Workflow](#membership-complete-workflow)
- [Important Notes](#important-notes)
- [Common Issues](#common-issues)
- [Error Handling](#error-handling)

---

## Quick Start

### Install SDK

```bash
npm install @ddcmarket/sdk
# or
yarn add @ddcmarket/sdk
# or
pnpm add @ddcmarket/sdk
```

### Basic Imports

```typescript
import {
  DDCNFTManager,
  MembershipManager,
  getKeyHash,
  getProvider,
  getSigner,
} from '@ddcmarket/sdk';
```

---

## Core Concepts

### What is Manager?

Manager is the core class of the SDK, used to manage contract operations. You need to initialize a Manager instance first, then perform all operations through it.

- **DDCNFTManager**: Used to manage NFT contracts
- **MembershipManager**: Used to manage membership contracts

### Two Usage Modes

#### 1. BrowserProvider Mode (Browser Wallet Mode)

Suitable for frontend applications where users operate through wallets like MetaMask.

```typescript
const manager = await DDCNFTManager.init({
  walletAddress: '0x...', // User wallet address
  provider: getProvider(window.ethereum), // Use getProvider to generate BrowserProvider like wrap Object
  debug: true, // Enable debug logging
});
```

**Features:**

- Users need to connect wallet in browser
- Each transaction requires user confirmation in wallet
- Suitable for user interaction scenarios

#### 2. JsonRpcProvider Mode (Backend Service Mode)

Suitable for backend services or Apps, using private key to automatically sign transactions.

```typescript
const manager = await DDCNFTManager.init({
  walletAddress: '', // Wallet address (can be empty in JsonRpcProvider Mode)
  provider: { type: 'jsonRpc' }, // JsonRpc mode identifier
  signer: { privateKey: 'your_private_key' }, // Private key
  debug: false,
});
```

**Features:**

- No user interaction required
- Transactions are automatically signed
- Suitable for automated service scenarios

### Key Terms

- **Factory Contract**: A factory contract used to deploy sub-contracts, only needs to be deployed once per network
- **Sub-contract**: Specific business contracts (NFT contract or membership contract) deployed through Factory, contracts that are used for business
- **Token ID**: Unique identifier for tokens, usually starting from 1
- **Key Hash**: Key hash value (bytes32 format) generated through `getKeyHash()` function, which is key point to use a mask for your real key or address for security design
- **Base URI**: Base URL for NFT metadata json file, used to construct complete Token URI, DDC offers default server URI for metadata file storage

---

## DDCNFT Complete Workflow

### Step Overview

```
1. Initialize Manager
   ↓
2. Deploy Factory Contract (if not exists)
   ↓
3. Deploy NFT Contract
   ↓
4. Set Base URI for metadata file
   ↓
5. Mint NFT
   ↓
6. Query/Transfer/Destroy NFT
```

### Detailed Steps

#### Step 1: Initialize Manager

**⚠️ Important: Wallet must be connected first!**

```typescript
// Check if wallet is connected
if (!window.ethereum) {
  throw new Error('Please install and connect wallet (e.g., MetaMask) first');
}

// Initialize Manager
const nftManager = await DDCNFTManager.init({
  walletAddress: userWalletAddress, // Get from wallet
  provider: getProvider(window.ethereum),
  debug: true, // Recommended for development
});

// Check if Factory contract already exists
const factoryAddress = nftManager.getFactoryAddress();
if (factoryAddress) {
  console.log('Factory contract exists:', factoryAddress);
} else {
  console.log('Need to deploy Factory contract');
}
```

**Notes:**

- Network configuration is automatically fetched from API during initialization
- If Factory contract already exists, it will be automatically loaded
- Recommend enabling `debug: true` in development to view detailed logs

#### Step 2: Deploy Factory Contract

**⚠️ Important: Factory contract only needs to be deployed once per network!**

```typescript
// Check if Factory already exists
if (!nftManager.getFactoryAddress()) {
  console.log('Starting Factory contract deployment...');
  console.log('This may take a few seconds, please wait for transaction confirmation...');

  const result = await nftManager.deployFactory();

  console.log('Factory deployed successfully!');
  console.log('Factory Address:', result.contractAddress);
  console.log('Transaction Hash:', result.transactionHash);
  console.log('Block Number:', result.blockNumber);
} else {
  console.log('Factory contract already exists, skipping deployment');
}
```

**Notes:**

- Factory contract deployment consumes Gas fees
- Address is automatically saved after deployment, will be automatically loaded on next initialization
- Ensure account has sufficient balance to pay Gas fees

#### Step 3: Deploy NFT Contract

**⚠️ Important: Factory contract must be deployed first!**

```typescript
// Prepare contract information
const nftName = 'MyNFT'; // NFT name (cannot be empty)
const nftSymbol = 'MNFT'; // NFT symbol (cannot be empty)

// Deploy NFT contract
const result = await nftManager.deployContract(nftName, nftSymbol);

console.log('NFT contract deployed successfully!');
console.log('Contract Address:', result.contractAddress);
console.log('Transaction Hash:', result.transactionHash);

// After deployment, it will be automatically set as current active contract
const currentAddress = nftManager.getContractAddress();
console.log('Current active contract:', currentAddress);
```

**Notes:**

- `name` and `symbol` cannot be empty
- After successful deployment, contract address is automatically set as current active contract
- Can view all deployed contracts through `getAllDeployedAddresses()`

#### Step 4: (Optional) Set Base URI

**⚠️ Important: Recommend setting Base URI before Minting!**

```typescript
// Method 1: Use default Base URI
const defaultURI = nftManager.getDefaultMetadataURL();
console.log('Default Base URI:', defaultURI);

// Method 2: Set custom Base URI
const customBaseURI = 'https://api.example.com/metadata/';
await nftManager.setBaseURI(customBaseURI);
console.log('Base URI set successfully');

// Note: Base URI path rule is: Base URI + contract address (as folder name)
// Example: https://api.example.com/metadata/0x1234.../
```

**Notes:**

- Base URI is used to construct Token URI, format: `baseURI + tokenId`
- If Base URI is set, all Token URIs will be constructed based on this
- Can also set individual URI for a single Token (see Step 6)

#### Step 5: Set/Clear Individual Token URI (if customized metadata file type needed, default metadata file: {Base URI} + {tokenId}.json)

**⚠️ Important: Individual URI for each Token consumes additional storage space (~20,000 gas)!**

```typescript
// Set full URI for a single Token
const tokenId = BigInt(1);
const fullURI = 'https://api.example.com/metadata/token-1.json';
const txHash = await nftManager.setTokenURI(tokenId, fullURI);
console.log('Token URI set successfully, Transaction Hash:', txHash);

// Clear individual Token URI (revert to baseURI + tokenId)
const clearTxHash = await nftManager.clearTokenURI(tokenId);
console.log('Token URI cleared, Transaction Hash:', clearTxHash);
```

**Notes:**

- Only use when Token needs completely different metadata
- Not recommended for bulk use as it consumes significant Gas
- After clearing, Token will revert to using `baseURI + tokenId`

#### Step 6: Mint NFT

**⚠️ Important: Contract address must be set first!**

```typescript
// Generate Key Hash (for ownership verification)
const secretKey = 'your-secret-key'; // Your secret key
const keyHash = getKeyHash(secretKey);
console.log('Key Hash:', keyHash);

// Mint NFT
const tokenId = BigInt(1); // Token ID, must be non-zero
const txHash = await nftManager.mint(tokenId, keyHash);

console.log('NFT Minted successfully!');
console.log('Token ID:', tokenId.toString());
console.log('Transaction Hash:', txHash);
```

**Notes:**

- `tokenId` must be `BigInt` type and cannot be 0
- `keyHash` is generated through `getKeyHash()`, used for subsequent transfer and destroy operations
- Minted NFT belongs to the caller (contract owner)
- Please keep `secretKey` safe, it will be needed for subsequent transfer and destroy operations

#### Step 7: Query NFT Information

```typescript
// Query contract information
const name = await nftManager.getName();
const symbol = await nftManager.getSymbol();
const owner = await nftManager.getOwner();
console.log(`Contract: ${name} (${symbol}), Owner: ${owner}`);

// Query Token information
const tokenId = BigInt(1);
const ownerHash = await nftManager.getOwnerOf(tokenId);
const tokenURI = await nftManager.getTokenURI(tokenId);
console.log(`Token #${tokenId} Owner Hash: ${ownerHash}`);
console.log(`Token URI: ${tokenURI}`);
```

#### Step 8: Transfer NFT

**⚠️ Important: Must own the Token to transfer!**

```typescript
// Generate recipient's Key Hash
const recipientSecretKey = 'recipient-secret-key';
const recipientHash = getKeyHash(recipientSecretKey);

// Transfer NFT
const tokenId = BigInt(1);
const transferKey = 'your-transfer-key'; // Key used for transfer
const txHash = await nftManager.transfer(recipientHash, tokenId, transferKey);

console.log('NFT transferred successfully!');
console.log('Recipient Hash:', recipientHash);
console.log('Transaction Hash:', txHash);
```

**Notes:**

- `transferKey` is the key used for transfer, must match the key used during Mint
- Recipient needs to provide their `secretKey` to generate `recipientHash`
- After transfer, original owner will lose ownership of the Token

#### Step 9: Destroy NFT

**⚠️ Warning: Destroy operation is irreversible!**

```typescript
const tokenId = BigInt(1);
const destroyKey = 'your-destroy-key'; // Key used for destroy
const txHash = await nftManager.destroy(tokenId, destroyKey);

console.log('NFT destroyed successfully!');
console.log('Transaction Hash:', txHash);
```

**Notes:**

- Destroy operation is irreversible, Token will be permanently deleted
- Must own the Token to destroy
- `destroyKey` must match the key used during Mint

#### Step 10: Contract Management Operations

```typescript
// Pause contract (contract owner only)
const pauseTxHash = await nftManager.pause();
console.log('Contract paused');

// Unpause contract (contract owner only)
const unpauseTxHash = await nftManager.unpause();
console.log('Contract unpaused');

// Transfer contract ownership (contract owner only, irreversible!)
const newOwner = '0x...'; // New owner address
const transferTxHash = await nftManager.transferOwnership(newOwner);
console.log('Ownership transferred');
```

**Notes:**

- After pausing, all transaction operations will be blocked
- Transfer ownership is an irreversible operation, please proceed with caution
- Only contract owner can execute these operations

---

## Membership Complete Workflow

### Step Overview

```
1. Initialize Manager
   ↓
2. Deploy Factory Contract (if not exists)
   ↓
3. Deploy Membership Contract
   ↓
4. Mint Membership Token
   ↓
5. Create Snapshot
   ↓
6. Query Snapshot Members
   ↓
7. Destroy Membership Token
```

### Detailed Steps

#### Steps 1-3: Initialization and Deployment

Similar to DDCNFT, refer to Steps 1-3 above, use `MembershipManager` instead of `DDCNFTManager`.

```typescript
// Initialize
const membershipManager = await MembershipManager.init({
  walletAddress: userWalletAddress,
  provider: new BrowserProvider(window.ethereum),
  debug: true,
});

// Deploy Factory (if needed)
if (!membershipManager.getFactoryAddress()) {
  await membershipManager.deployFactory();
}

// Deploy Membership contract
const result = await membershipManager.deployContract('MyDAO', 'MDAO');
```

#### Step 4: Mint Membership Token

```typescript
// Generate member address hash
const memberAddress = '0x...'; // Member's Ethereum address
const memberHash = getKeyHash(memberAddress);

// Mint Membership Token
const tokenId = BigInt(1);
const result = await membershipManager.mintMembership(tokenId, memberHash);

console.log('Membership Token minted successfully!');
console.log('Token ID:', result.tokenId.toString());
console.log('Member Address Hash:', result.to);
console.log('Transaction Hash:', result.transactionHash);
```

**Notes:**

- `memberHash` is the hash value of member address, used to identify member identity
- Each Token ID corresponds to one member

#### Step 5: Create Snapshot

**⚠️ Important: Snapshot is used to record all members at a specific point in time, commonly used in governance voting scenarios!**

```typescript
const snapshotId = await membershipManager.createSnapshot();
console.log('Snapshot created successfully!');
console.log('Snapshot ID:', snapshotId.toString());
```

**Notes:**

- Snapshot ID starts from 1 and increments
- Snapshot records all current member address hashes at creation time
- Snapshot will not update after creation even if members change

#### Step 6: Query Snapshot Members

```typescript
// Query all members in snapshot
const snapshotId = BigInt(1);
const members = await membershipManager.getMemberSnapshot(snapshotId);
console.log(`Snapshot #${snapshotId} has ${members.length} members`);
members.forEach((member, index) => {
  console.log(`Member ${index + 1}: ${member}`);
});

// Query latest snapshot ID
const latestId = await membershipManager.getLatestSnapshotId();
console.log('Latest Snapshot ID:', latestId.toString());

// Check if an address is a snapshot member
const checkAddress = '0x...';
const addressHash = getKeyHash(checkAddress);
const isMember = await membershipManager.isMemberInSnapshot(snapshotId, addressHash);
console.log(`Address ${checkAddress} ${isMember ? 'is' : 'is not'} a snapshot member`);
```

#### Step 7: Query Membership Information

```typescript
// Query contract information
const name = await membershipManager.getName();
const symbol = await membershipManager.getSymbol();
const totalSupply = await membershipManager.getTotalSupply();
console.log(`Contract: ${name} (${symbol}), Total Supply: ${totalSupply}`);
```

#### Step 8: Destroy Membership Token

```typescript
const tokenId = BigInt(1);
const memberAddress = '0x...'; // Member address
const addressHash = getKeyHash(memberAddress);

const result = await membershipManager.destroyMembership(tokenId, addressHash);
console.log('Membership Token destroyed successfully!');
console.log('Token ID:', result.tokenId.toString());
console.log('Previous Owner Hash:', result.from);
console.log('Transaction Hash:', result.transactionHash);
```

---

## Important Notes

### ⚠️ Operation Order Requirements

1. **Must initialize Manager first, and recommond only once** before executing any operations
2. **Must deploy Factory first** before deploying sub-contracts
3. **Must deploy sub-contract first** before performing Mint and other operations
4. **Recommend setting Base URI before Mint** to correctly construct Token URI

### 🔐 Key Management

- **Private keys and secret keys must be kept strictly confidential**, do not commit to code repository
- Use environment variables or secure key management services to store keys
- `secretKey` is used to generate `keyHash`, needed for subsequent transfer and destroy operations
- Recommend using different keys for each operation

### 💰 Gas Fees

- All on-chain operations consume Gas fees
- Ensure account has sufficient balance
- Deploying Factory and sub-contracts consumes significant Gas
- Setting individual Token URI consumes additional storage fees (~20,000 gas)

### 📝 Contract Address Management

```typescript
// Get all deployed contracts
const contracts = manager.getAllDeployedAddresses();
console.log('Deployed contracts:', contracts);

// Switch to another contract
manager.setContractAddress('0x...');

// Get currently used contract address
const currentAddress = manager.getContractAddress();
```

### 🔄 Contract Selection

- After deploying new contract, it will be automatically set as current active contract
- Can switch to other deployed contracts through `setContractAddress()`
- All operations are based on currently set contract address

### 🎯 Vue 3 Special Notes

**⚠️ Important: When using in Vue 3, must use `toRaw()` to avoid Proxy issues!**

```typescript
import { toRaw } from 'vue';

// ❌ Wrong way (may error: Receiver must be an instance of class anonymous)
await nftManager.value.mint(BigInt(1), keyHash);

// ✅ Correct way
const rawManager = toRaw(nftManager.value);
await rawManager.mint(BigInt(1), keyHash);
```

### 📊 Network Configuration

- SDK automatically fetches network configuration from API
- In BrowserProvider mode, SDK automatically validates and switches network
- In JsonRpcProvider mode, network configuration is automatically fetched

---

## Common Issues

### Q1: Initialization failed, error "Provider not available"

**Cause:** Wallet not connected or `window.ethereum` does not exist

**Solution:**

```typescript
// Check if wallet is installed
if (!window.ethereum) {
  alert('Please install MetaMask or other wallet extension first');
  return;
}

// Request wallet connection
await window.ethereum.request({ method: 'eth_requestAccounts' });
```

### Q2: Deployment failed, error "Insufficient funds"

**Cause:** Account balance insufficient, cannot pay Gas fees

**Solution:** Deposit sufficient tokens to account for paying Gas fees

### Q3: Mint failed, error "Contract address not set"

**Cause:** Contract address not set or contract not deployed

**Solution:**

```typescript
// Check contract address
const address = manager.getContractAddress();
if (!address) {
  // Deploy contract or set existing contract address
  await manager.deployContract('MyNFT', 'MNFT');
  // or
  manager.setContractAddress('0x...');
}
```

### Q4: Transfer failed, error "Contract call failed"

**Possible causes:**

- Do not own the Token
- Contract is paused
- `transferKey` is incorrect

**Solution:**

```typescript
// Check if own the Token
const ownerHash = await manager.getOwnerOf(tokenId);
const myHash = getKeyHash(mySecretKey);
if (ownerHash !== myHash) {
  console.error('You do not own this Token');
  return;
}

// Check contract status
// If contract is paused, need to unpause first
```

### Q5: Token URI query returns empty or error

**Possible causes:**

- Base URI not set
- Token does not exist
- URI format incorrect

**Solution:**

```typescript
// Set Base URI
await manager.setBaseURI('https://api.example.com/metadata/');

// Or set URI for individual Token
await manager.setTokenURI(tokenId, 'https://api.example.com/metadata/token-1.json');
```

### Q6: Error when calling methods in Vue 3

**Cause:** Vue 3's reactive Proxy causing issues

**Solution:** Use `toRaw()` to wrap Manager instance

```typescript
import { toRaw } from 'vue';
const rawManager = toRaw(manager.value);
await rawManager.mint(BigInt(1), keyHash);
```

---

## Error Handling

### Unified Error Handling

SDK throws `SDKError`, recommend unified error handling:

```typescript
try {
  const result = await manager.deployContract('MyNFT', 'MNFT');
  console.log('Success:', result);
} catch (error) {
  if (error instanceof SDKError) {
    console.error('SDK Error:', error.message);
    console.error('Error Code:', error.code);
    console.error('Error Details:', error.details);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Common Error Codes

- `NETWORK_CONFIG_NOT_AVAILABLE`: Network configuration not available
- `PROVIDER_NOT_AVAILABLE`: Provider not available
- `NO_CONTRACT_ADDRESS`: Contract address not set
- `CONTRACT_NOT_DEPLOYED`: Contract not deployed
- `INSUFFICIENT_FUNDS`: Insufficient funds
- `USER_REJECTED`: User rejected transaction
- `CONTRACT_CALL_FAILED`: Contract call failed
- `INVALID_PARAMETER`: Invalid parameter
- `INVALID_TOKEN_ID`: Invalid Token ID (must be non-zero)

### Error Handling Best Practices

```typescript
async function safeOperation(operation: () => Promise<any>) {
  try {
    return await operation();
  } catch (error: any) {
    if (error instanceof SDKError) {
      // Handle differently based on error code
      switch (error.code) {
        case 'INSUFFICIENT_FUNDS':
          alert('Insufficient balance, please deposit and try again');
          break;
        case 'USER_REJECTED':
          console.log('User cancelled transaction');
          break;
        case 'CONTRACT_CALL_FAILED':
          alert('Contract call failed, please check parameters and permissions');
          break;
        default:
          alert(`Operation failed: ${error.message}`);
      }
    } else {
      console.error('Unknown error:', error);
      alert('Unknown error occurred, please check console');
    }
    throw error; // Re-throw for upper level handling
  }
}

// Usage example
await safeOperation(async () => {
  return await manager.mint(BigInt(1), keyHash);
});
```

---

## Complete Example Code

### DDCNFT Complete Example

```typescript
import { DDCNFTManager, getKeyHash } from '@ddcmarket/sdk';
import { BrowserProvider } from 'ethers';

async function ddcnftWorkflow() {
  try {
    // 1. Initialize
    const manager = await DDCNFTManager.init({
      walletAddress: userAddress,
      provider: new BrowserProvider(window.ethereum),
      debug: true,
    });

    // 2. Deploy Factory (if needed)
    if (!manager.getFactoryAddress()) {
      const factoryResult = await manager.deployFactory();
      console.log('Factory deployed:', factoryResult.contractAddress);
    }

    // 3. Deploy NFT contract
    const nftResult = await manager.deployContract('MyNFT', 'MNFT');
    console.log('NFT contract deployed:', nftResult.contractAddress);

    // 4. Set Base URI (optional)
    await manager.setBaseURI('https://api.example.com/metadata/');

    // 5. Mint NFT
    const keyHash = getKeyHash('my-secret-key');
    const mintTx = await manager.mint(BigInt(1), keyHash);
    console.log('Mint transaction:', mintTx);

    // 6. Query information
    const name = await manager.getName();
    const uri = await manager.getTokenURI(BigInt(1));
    console.log(`Contract: ${name}, Token URI: ${uri}`);
  } catch (error) {
    console.error('Operation failed:', error);
  }
}
```

### Membership Complete Example

```typescript
import { MembershipManager, getKeyHash } from '@ddcmarket/sdk';
import { BrowserProvider } from 'ethers';

async function membershipWorkflow() {
  try {
    // 1. Initialize
    const manager = await MembershipManager.init({
      walletAddress: userAddress,
      provider: new BrowserProvider(window.ethereum),
      debug: true,
    });

    // 2. Deploy Factory (if needed)
    if (!manager.getFactoryAddress()) {
      await manager.deployFactory();
    }

    // 3. Deploy Membership contract
    const result = await manager.deployContract('MyDAO', 'MDAO');
    console.log('Membership contract deployed:', result.contractAddress);

    // 4. Mint Membership Token
    const memberHash = getKeyHash('member-address');
    const mintResult = await manager.mintMembership(BigInt(1), memberHash);
    console.log('Membership Token minted:', mintResult.to);

    // 5. Create snapshot
    const snapshotId = await manager.createSnapshot();
    console.log('Snapshot ID:', snapshotId);

    // 6. Query snapshot members
    const members = await manager.getMemberSnapshot(snapshotId);
    console.log('Snapshot member count:', members.length);
  } catch (error) {
    console.error('Operation failed:', error);
  }
}
```

---

## Summary

### Key Points

1. **Operation order is important**: Initialize → Deploy Factory → Deploy Sub-contract → Operations
2. **Key management must be secure**: Do not leak private keys and secret keys
3. **Gas fees must be sufficient**: Ensure account has sufficient balance
4. **Error handling must be complete**: Use try-catch to catch and handle errors
5. **Vue 3 must use toRaw**: Avoid reactive Proxy issues

### Next Steps

- View [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) to learn the complete API list
- Refer to [demo examples](./demo/src/components/demo/) to see actual usage code
- If you have questions, check error messages and logs for troubleshooting

---

**Happy coding!** 🚀
