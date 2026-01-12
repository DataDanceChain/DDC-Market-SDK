# DDC Market SDK API Documentation

This document organizes SDK APIs in the order of usage flow, from initialization to contract operations.

## Table of Contents

- [1. Initialization](#1-initialization)
- [2. Factory Contract Deployment](#2-factory-contract-deployment)
- [3. Sub-contract Deployment](#3-sub-contract-deployment)
- [4. Contract Selection and Management](#4-contract-selection-and-management)
- [5. DDCNFT Contract Operations](#5-ddcnft-contract-operations)
- [6. Membership Contract Operations](#6-membership-contract-operations)
- [7. Common Contract Operations](#7-common-contract-operations)
- [8. Utility Functions](#8-utility-functions)

---

## 1. Initialization

### 1.1 DDCNFTManager.init()

Initialize DDCNFT Manager instance.

**Method Signature:**

```typescript
static async init(manageConfig: ManagerParams): Promise<DDCNFTManager>
```

**Parameters:**

- `manageConfig` (ManagerParams)
  - `walletAddress` (string): Wallet address, Empty if is JsonRpcProvider mode by private key
  - `provider` (BrowserProvider | JsonRpcProviderDescriptor): Provider instance or descriptor
    - BrowserProvider mode: Pass `new BrowserProvider(window.ethereum)` instance
    - JsonRpcProvider mode: Pass `{ type: 'jsonRpc' }` descriptor
  - `signer` (SignerConfig, optional): Required in JsonRpcProvider mode
    - `privateKey` (string): Private key
  - `debug` (boolean, optional): Enable debug logging

**Return Value:**

- `Promise<DDCNFTManager>`: Manager instance

**Example:**

```typescript
// BrowserProvider mode
import { BrowserProvider } from 'ethers';
import { getProvider, getSigner, getAddress, DDCNFTManager } from '@ddc-market/sdk';

const provider = getProvider(window.ethereum);
const manager: DDCNFTManager = await DDCNFTManager.init({
  walletAddress: '0x...',
  provider: provider,
  debug: true,
});

// JsonRpcProvider mode
const manager = await DDCNFTManager.init({
  walletAddress: '0x...',
  provider: { type: 'jsonRpc' },
  signer: { privateKey: 'your_seceret_key' },
  debug: false,
});
```

**Notes:**

- Only one global instance is needed for initialization
- Network configuration is automatically fetched from API during initialization
- In JsonRpcProvider mode, rpcUrl and chainId are automatically fetched from API
- If factory contract address already exists, it will be automatically loaded

---

### 1.2 MembershipManager.init()

Initialize Membership Manager instance.

**Method Signature:**

```typescript
static async init(manageConfig: ManagerParams): Promise<MembershipManager>
```

**Parameters:**

- Same as `DDCNFTManager.init()`

**Return Value:**

- `Promise<MembershipManager>`: Manager instance

**Example:**

```typescript
import { MembershipManager } from '@ddc-market/sdk';

// BrowserProvider mode
const manager: MembershipManager = await MembershipManager.init({
  walletAddress: '0x...',
  provider: new BrowserProvider(window.ethereum),
  debug: true,
});

// JsonRpcProvider mode
const manager = await MembershipManager.init({
  walletAddress: '0x...',
  provider: { type: 'jsonRpc' },
  signer: { privateKey: 'your_seceret_key' },
  debug: false,
});
```

---

## 2. Factory Contract Deployment

### 2.1 deployFactory()

Deploy factory contract (DDCNFTFactory or MembershipFactory).

**Method Signature:**

```typescript
public async deployFactory(): Promise<DeploymentResult>
```

**Parameters:**

- None

**Return Value:**

- `Promise<DeploymentResult>`
  - `contractAddress` (string): Factory contract address
  - `transactionHash` (string): Transaction hash
  - `blockNumber` (number): Block number

**Example:**

```typescript
import { DeploymentResult } from '@ddc-market/sdk';

// DDCNFT
const result: DeploymentResult = await ddcnftManager.deployFactory();
console.log(`Factory deployed at: ${result.contractAddress}`);

// Membership
const result = await membershipManager.deployFactory();
console.log(`Factory deployed at: ${result.contractAddress}`);
```

**Notes:**

- Factory contract currently only supports deploying one address!
- Network connection is automatically validated before deployment
- Sufficient gas fees are required
- Factory address is automatically reported to backend after successful deployment

---

### 2.2 getFactoryAddress()

Get factory contract address.

**Method Signature:**

```typescript
public getFactoryAddress(): string
```

**Return Value:**

- `string`: Factory contract address (returns empty string if not deployed)

**Example:**

```typescript
const factoryAddress = manager.getFactoryAddress();
if (factoryAddress) {
  console.log(`Factory address: ${factoryAddress}`);
} else {
  console.log('Factory not deployed yet');
}
```

---

## 3. Sub-contract Deployment

### 3.1 deployContract()

Deploy sub-contract (DDCNFT or Membership) via factory contract.

**Method Signature:**

```typescript
public async deployContract(name: string, symbol: string): Promise<DeploymentResult>
```

**Parameters:**

- `name` (string): Contract name (cannot be empty)
- `symbol` (string): Contract symbol (cannot be empty)

**Return Value:**

- `Promise<DeploymentResult>`
  - `contractAddress` (string): Deployed contract address
  - `transactionHash` (string): Transaction hash
  - `blockNumber` (number): Block number

**Example:**

```typescript
import { DeploymentResult } from '@ddc-market/sdk';

// Deploy DDCNFT contract
const result: DeploymentResult = await ddcnftManager.deployContract('MyNFT', 'MNFT');
console.log(`NFT contract deployed at: ${result.contractAddress}`);

// Deploy Membership contract
const result = await membershipManager.deployContract('MyDAO', 'MDAO');
console.log(`Membership contract deployed at: ${result.contractAddress}`);
```

**Notes:**

- Factory contract must be deployed first
- Network connection is automatically validated before deployment
- Deployed contract is automatically set as current active contract
- Deployed contract address is automatically added to deployed contracts list

---

### 3.3 getAllDeployedAddresses()

Get all deployed contract addresses list.

**Method Signature:**

```typescript
public getAllDeployedAddresses(): ReadonlyArray<string>
```

**Return Value:**

- `ReadonlyArray<string>`: Array of deployed contract addresses

**Example:**

```typescript
const contracts = manager.getAllDeployedAddresses();
console.log(`Found ${contracts.length} deployed contracts`);
contracts.forEach((address, index) => {
  console.log(`${index + 1}. ${address}`);
});
```

---

## 4. Contract Selection and Management

### 4.1 setContractAddress()

Set current active contract address.

**Method Signature:**

```typescript
public setContractAddress(address: string): void
```

**Parameters:**

- `address` (string): Contract address

**Example:**

```typescript
manager.setContractAddress('0x1234...');
```

**Notes:**

- After setting, all subsequent contract operations will use this address
- Address format will be validated

---

### 4.2 getContractAddress()

Get current active contract address.

**Method Signature:**

```typescript
public getContractAddress(): string | undefined
```

**Return Value:**

- `string | undefined`: Current contract address, returns `undefined` if not set

**Example:**

```typescript
const address = manager.getContractAddress();
if (address) {
  console.log(`Current contract: ${address}`);
}
```

---

### 4.3 getContract()

Get contract instance (for directly calling contract methods).

**Method Signature:**

```typescript
public async getContract(contractAddress?: string): Promise<Contract>
```

**Parameters:**

- `contractAddress` (string, optional): Contract address, uses currently set address if not provided

**Return Value:**

- `Promise<Contract>`: ethers Contract instance

**Example:**

```typescript
// Use currently set contract address
const contract = await manager.getContract();

// Use specified contract address
const contract = await manager.getContract('0x1234...');
```

**Notes:**

- Returned Contract instance is connected with signer and can directly call contract methods
- Note: When using in Vue 3, use `toRaw()` to avoid Proxy issues

---

## 5. DDCNFT Contract Operations

### 5.1 mint()

Mint NFT.

**Method Signature:**

```typescript
public async mint(tokenId: bigint, keyHash: string): Promise<string>
```

**Parameters:**

- `tokenId` (bigint): Token ID (must be non-zero)
- `keyHash` (string): Key hash (bytes32 format, 0x + 64 hex characters, cannot be zero value)

**Return Value:**

- `Promise<string>`: Transaction hash

**Example:**

```typescript
import { getKeyHash } from '@ddc-market/sdk';

// Generate keyHash
const keyHash = getKeyHash('your-secret-key');

// Mint NFT
const txHash = await ddcnftManager.mint(BigInt(1), keyHash);
console.log(`Mint transaction: ${txHash}`);
```

**Notes:**

- Contract address must be set first
- keyHash can be generated using `getKeyHash()` utility function
- Minted NFT will belong to the caller (contract owner)

---

### 5.2 transfer()

Transfer NFT.

**Method Signature:**

```typescript
public async transfer(toHash: string, tokenId: bigint, key: string): Promise<string>
```

**Parameters:**

- `toHash` (string): Recipient address hash (bytes32 format)
- `tokenId` (bigint): Token ID
- `key` (string): Transfer key (cannot be empty)

**Return Value:**

- `Promise<string>`: Transaction hash

**Example:**

```typescript
import { getKeyHash } from '@ddc-market/sdk';

// Generate recipient hash
const recipientHash = getKeyHash('recipient-secret-key');

// Transfer NFT
const txHash = await ddcnftManager.transfer(recipientHash, BigInt(1), 'your-transfer-key');
console.log(`Transfer transaction: ${txHash}`);
```

**Notes:**

- Contract address must be set first
- Must own the token
- key is the key used for transfer

---

### 5.3 destroy()

Destroy (burn) NFT.

**Method Signature:**

```typescript
public async destroy(tokenId: bigint, key: string): Promise<string>
```

**Parameters:**

- `tokenId` (bigint): Token ID
- `key` (string): Destroy key (cannot be empty)

**Return Value:**

- `Promise<string>`: Transaction hash

**Example:**

```typescript
const txHash = await ddcnftManager.destroy(BigInt(1), 'your-destroy-key');
console.log(`Destroy transaction: ${txHash}`);
```

**Notes:**

- Contract address must be set first
- Must own the token
- Token will be permanently destroyed after this operation

---

### 5.4 pause()

Pause contract (only contract owner can call).

**Method Signature:**

```typescript
public async pause(): Promise<string>
```

**Parameters:**

- None

**Return Value:**

- `Promise<string>`: Transaction hash

**Example:**

```typescript
const txHash = await ddcnftManager.pause();
console.log(`Pause transaction: ${txHash}`);
```

---

### 5.5 unpause()

Unpause contract (only contract owner can call).

**Method Signature:**

```typescript
public async unpause(): Promise<string>
```

**Parameters:**

- None

**Return Value:**

- `Promise<string>`: Transaction hash

**Example:**

```typescript
const txHash = await ddcnftManager.unpause();
console.log(`Unpause transaction: ${txHash}`);
```

---

### 5.6 setTokenURI()

Set an individual full URI for a specific token.

**Method Signature:**

```typescript
public async setTokenURI(tokenId: bigint, uri: string): Promise<string>
```

**Parameters:**

- `tokenId` (bigint): Token ID (must be non-zero)
- `uri` (string): Full URI string for the token (cannot be empty)

**Return Value:**

- `Promise<string>`: Transaction hash

**Example:**

```typescript
// Set individual URI for a specific token
const txHash = await ddcnftManager.setTokenURI(
  BigInt(1),
  'https://api.example.com/metadata/token-1.json'
);
console.log(`Set token URI transaction: ${txHash}`);
```

**Notes:**

- Contract address must be set first
- Use only when the token needs completely different metadata from others
- Each call consumes an additional storage slot (~20,000 gas) - not recommended for bulk use
- After setting, the token will use this individual URI instead of baseURI + tokenId
- Only contract owner can call this method

---

### 5.7 clearTokenURI()

Clear the individual URI for a specific token.

**Method Signature:**

```typescript
public async clearTokenURI(tokenId: bigint): Promise<string>
```

**Parameters:**

- `tokenId` (bigint): Token ID (must be non-zero)

**Return Value:**

- `Promise<string>`: Transaction hash

**Example:**

```typescript
// Clear individual URI for a specific token
const txHash = await ddcnftManager.clearTokenURI(BigInt(1));
console.log(`Clear token URI transaction: ${txHash}`);
```

**Notes:**

- Contract address must be set first
- After clearing, the token will fall back to using baseURI + tokenId
- This frees up the storage slot used by the individual URI
- Only contract owner can call this method

---

## Managing metadata and relative files on DDC OSS service

### 5.8 uploadMetadataFile()

Upload metadata file (e.g., image, video) to OSS storage for DDCNFT contract.

**Method Signature:**

```typescript
public async uploadMetadataFile(file: File): Promise<{ fileUrl: string; fileName: string }>
```

**Parameters:**

- `file` (File): File object to upload (e.g., image, video, or other media files)

**Return Value:**

- `Promise<{ fileUrl: string; fileName: string }>`
  - `fileUrl` (string): URL of the uploaded file (OSS object URL hint)
  - `fileName` (string): Name of the uploaded file

**Example:**

```typescript
// Handle file input from user
const handleFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    uploadFile(file);
  }
};

// Upload file
const uploadFile = async (file: File) => {
  try {
    const result = await ddcnftManager.uploadMetadataFile(file);
    console.log(`File uploaded: ${result.fileUrl}`);
    console.log(`File name: ${result.fileName}`);
    // Use fileUrl in metadata or setTokenURI
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

**Notes:**

- Contract address must be set first
- Automatically handles authentication token refresh if expired
- File extension is automatically extracted from file name
- Uploaded file is stored in OSS (Object Storage Service) provided by DDC
- The returned `fileUrl` can be used in metadata JSON or directly set as token URI
- Supported file types depend on OSS configuration (typically images, videos, documents)

---

### 5.9 updateCustomMetadata()

Create or update custom metadata JSON for a token and optionally set it as token URI.

**Method Signature:**

```typescript
public async updateCustomMetadata(
  defaultConfig: {
    name: string;
    description: string;
    image: string;
  },
  customMetadata: Record<string, any>,
  autoSetTokenId: number = -1
): Promise<{ fileUrl: string; fileName: string }>
```

**Parameters:**

- `defaultConfig` (object): Default metadata fields
  - `name` (string): Name of the metadata/NFT
  - `description` (string): Description of the metadata/NFT
  - `image` (string): Image URL (typically from `uploadMetadataFile()` result)
- `customMetadata` (Record<string, any>): Custom metadata fields (any additional properties)
- `autoSetTokenId` (number, optional): Token ID to automatically set token URI. If > 0, will call `setTokenURI()` automatically. Default: -1 (no automatic setting)

**Return Value:**

- `Promise<{ fileUrl: string; fileName: string }>`
  - `fileUrl` (string): URL of the uploaded metadata JSON file
  - `fileName` (string): Name of the uploaded metadata file

**Example:**

```typescript
// First, upload an image file
const imageResult = await ddcnftManager.uploadMetadataFile(imageFile);
const { fileUrl: imageUrl, fileName: imageFileName } = imageResult;

// Then, create metadata with default and custom fields
const metadataResult = await ddcnftManager.updateCustomMetadata(
  {
    name: 'My Awesome NFT',
    description: 'This is a description of my NFT',
    image: imageUrl, // Use the uploaded image URL
  },
  {
    // Custom metadata fields
    contract: '0x1f7a9d34768e052b57783dc2ac2e7ff5125080bd',
    attributes: [
      { trait_type: 'Color', value: 'Blue' },
      { trait_type: 'Rarity', value: 'Legendary' },
    ],
    external_url: 'https://example.com/nft/1',
    fileName: imageFileName,
  },
  6 // Automatically set token URI for token ID 6
);

console.log(`Metadata uploaded: ${metadataResult.fileUrl}`);
console.log(`Metadata file name: ${metadataResult.fileName}`);
```

**Complete Workflow Example:**

```typescript
// Complete workflow: Upload image and create metadata
const handleCreateNFTMetadata = async (imageFile: File, tokenId: number) => {
  if (!ddcnftManager) {
    console.error('Manager not initialized');
    return;
  }

  try {
    // Step 1: Upload image file
    const imageResult = await ddcnftManager.uploadMetadataFile(imageFile);
    console.log('Image uploaded:', imageResult.fileUrl);

    // Step 2: Create and upload metadata JSON
    const metadataResult = await ddcnftManager.updateCustomMetadata(
      {
        name: 'My NFT #' + tokenId,
        description: 'A unique NFT with custom metadata',
        image: imageResult.fileUrl,
      },
      {
        // Custom attributes
        attributes: [
          { trait_type: 'Power', value: 100 },
          { trait_type: 'Speed', value: 85 },
        ],
        creator: '0x...',
        creationDate: new Date().toISOString(),
      },
      tokenId // Automatically set as token URI
    );

    console.log('Metadata created and set:', metadataResult.fileUrl);
    console.log(`Token ${tokenId} now points to: ${metadataResult.fileUrl}`);
  } catch (error) {
    console.error('Failed to create metadata:', error);
  }
};
```

**Notes:**

- Contract address must be set first
- Automatically handles authentication token refresh if expired
- Metadata is merged: `customMetadata` properties are merged with `defaultConfig` (customMetadata takes precedence for overlapping keys)
- Metadata is uploaded as JSON file to OSS
- If `autoSetTokenId > 0`, automatically calls `setTokenURI()` to link the metadata to the token
- If `autoSetTokenId <= 0`, only uploads metadata without setting token URI (you can manually call `setTokenURI()` later)
- The metadata JSON follows standard NFT metadata format (OpenSea, etc.)
- Custom metadata can include any additional properties beyond name, description, and image

---

## 6. Membership Contract Operations

### 6.1 mintMembership()

Mint membership token.

**Method Signature:**

```typescript
public async mintMembership(tokenId: bigint, addressHash: string): Promise<MintResult>
```

**Parameters:**

- `tokenId` (bigint): Token ID
- `addressHash` (string): Member address hash (bytes32 format, cannot be zero value)

**Return Value:**

- `Promise<MintResult>`
  - `tokenId` (bigint): Token ID
  - `to` (string): Recipient address hash
  - `transactionHash` (string): Transaction hash
  - `blockNumber` (number): Block number

**Example:**

```typescript
import { getKeyHash } from '@ddc-market/sdk';

// Generate member address hash
const memberHash = getKeyHash('member-address-or-key');

// Mint membership token
const result = await membershipManager.mintMembership(BigInt(1), memberHash);
console.log(`Token minted to: ${result.to}`);
console.log(`Transaction: ${result.transactionHash}`);
```

---

### 6.2 destroyMembership()

Destroy (redeem) membership token.

**Method Signature:**

```typescript
public async destroyMembership(tokenId: bigint, addressHash: string): Promise<DestroyResult>
```

**Parameters:**

- `tokenId` (bigint): Token ID
- `addressHash` (string): Member address hash (bytes32 format)

**Return Value:**

- `Promise<DestroyResult>`
  - `tokenId` (bigint): Token ID
  - `from` (string): Previous owner address hash
  - `transactionHash` (string): Transaction hash
  - `blockNumber` (number): Block number

**Example:**

```typescript
import { getKeyHash } from '@ddc-market/sdk';

const memberHash = getKeyHash('member-address');
const result = await membershipManager.destroyMembership(BigInt(1), memberHash);
console.log(`Token destroyed. Previous owner: ${result.from}`);
```

---

### 6.3 createSnapshot()

Create membership snapshot.

**Method Signature:**

```typescript
public async createSnapshot(): Promise<bigint>
```

**Parameters:**

- None

**Return Value:**

- `Promise<bigint>`: Snapshot ID

**Example:**

```typescript
const snapshotId = await membershipManager.createSnapshot();
console.log(`Snapshot created with ID: ${snapshotId}`);
```

**Notes:**

- Snapshot records all current member address hashes
- Snapshot ID starts from 1 and increments

---

### 6.4 getMemberSnapshot()

Get member list in snapshot.

**Method Signature:**

```typescript
public async getMemberSnapshot(snapshotId: bigint): Promise<string[]>
```

**Parameters:**

- `snapshotId` (bigint): Snapshot ID

**Return Value:**

- `Promise<string[]>`: Array of member address hashes

**Example:**

```typescript
const members = await membershipManager.getMemberSnapshot(BigInt(1));
console.log(`Snapshot has ${members.length} members`);
members.forEach((member, index) => {
  console.log(`Member ${index + 1}: ${member}`);
});
```

**Notes:**

- Returns empty array if snapshot does not exist

---

### 6.5 getLatestSnapshotId()

Get latest snapshot ID.

**Method Signature:**

```typescript
public async getLatestSnapshotId(): Promise<bigint>
```

**Parameters:**

- None

**Return Value:**

- `Promise<bigint>`: Latest snapshot ID (returns 0 if no snapshots exist)

**Example:**

```typescript
const latestId = await membershipManager.getLatestSnapshotId();
console.log(`Latest snapshot ID: ${latestId}`);
```

---

### 6.6 isMemberInSnapshot()

Check if member is in snapshot.

**Method Signature:**

```typescript
public async isMemberInSnapshot(snapshotId: bigint, addressHash: string): Promise<boolean>
```

**Parameters:**

- `snapshotId` (bigint): Snapshot ID
- `addressHash` (string): Member address hash

**Return Value:**

- `Promise<boolean>`: Whether member is in snapshot

**Example:**

```typescript
import { getKeyHash } from '@ddc-market/sdk';

const memberHash = getKeyHash('member-address');
const isMember = await membershipManager.isMemberInSnapshot(BigInt(1), memberHash);
console.log(`Is member: ${isMember}`);
```

---

### 6.7 getTotalSupply()

Get total supply of membership tokens.

**Method Signature:**

```typescript
public async getTotalSupply(): Promise<bigint>
```

**Parameters:**

- None

**Return Value:**

- `Promise<bigint>`: Total supply

**Example:**

```typescript
const supply = await membershipManager.getTotalSupply();
console.log(`Total supply: ${supply}`);
```

---

## 7. Common Contract Operations

### 7.1 getName()

Get contract name.

**Method Signature:**

```typescript
public async getName(): Promise<string>
```

**Parameters:**

- None

**Return Value:**

- `Promise<string>`: Contract name

**Example:**

```typescript
const name = await manager.getName();
console.log(`Contract name: ${name}`);
```

---

### 7.2 getSymbol()

Get contract symbol.

**Method Signature:**

```typescript
public async getSymbol(): Promise<string>
```

**Parameters:**

- None

**Return Value:**

- `Promise<string>`: Contract symbol

**Example:**

```typescript
const symbol = await manager.getSymbol();
console.log(`Contract symbol: ${symbol}`);
```

---

### 7.3 getOwner()

Get contract owner address.

**Method Signature:**

```typescript
public async getOwner(): Promise<string>
```

**Parameters:**

- None

**Return Value:**

- `Promise<string>`: Owner address

**Example:**

```typescript
const owner = await manager.getOwner();
console.log(`Contract owner: ${owner}`);
```

---

### 7.4 getOwnerOf()

Get token owner (hash).

**Method Signature:**

```typescript
public async getOwnerOf(tokenId: bigint): Promise<string>
```

**Parameters:**

- `tokenId` (bigint): Token ID

**Return Value:**

- `Promise<string>`: Owner address hash (bytes32)

**Example:**

```typescript
const ownerHash = await manager.getOwnerOf(BigInt(1));
console.log(`Token owner hash: ${ownerHash}`);
```

---

### 7.5 getTokenURI()

Get Token URI.

**Method Signature:**

```typescript
public async getTokenURI(tokenId: bigint): Promise<string>
```

**Parameters:**

- `tokenId` (bigint): Token ID

**Return Value:**

- `Promise<string>`: Token URI

**Example:**

```typescript
const uri = await manager.getTokenURI(BigInt(1));
console.log(`Token URI: ${uri}`);
```

**Notes:**

- Note: DDC provides OSS service for storing Metadata by default, which is the root service domain of OSS
- If privacy is required, manually set Metadata URI after contract deployment!

---

### 7.6 setBaseURI()

Set base URI (only contract owner can call).

**Method Signature:**

```typescript
public async setBaseURI(baseURI: string): Promise<void>
```

**Parameters:**

- `baseURI` (string): Base URI

**Return Value:**

- `Promise<void>`

**Example:**

```typescript
await manager.setBaseURI(`https://api.example.com/metadata/${contractAddress}/`);
```

**Notes:**

- Note: Path rule is: OSS root service domain + current contract address (folder directory name where Metadata is stored)

---

### 7.7 transferOwnership()

Transfer contract ownership (only contract owner can call).

**Method Signature:**

```typescript
public async transferOwnership(newOwner: string): Promise<string>
```

**Parameters:**

- `newOwner` (string): New owner address

**Return Value:**

- `Promise<string>`: Transaction hash

**Example:**

```typescript
const txHash = await manager.transferOwnership('0x...');
console.log(`Ownership transferred: ${txHash}`);
```

---

### 7.8 getDefaultMetadataURL()

Get default metadata URL (DDC default provided URI).

**Method Signature:**

```typescript
public getDefaultMetadataURL(): string
```

**Parameters:**

- None

**Return Value:**

- `string`: Default metadata URL

**Example:**

```typescript
const metadataUrl = manager.getDefaultMetadataURL();
console.log(`Default metadata URL: ${metadataUrl}`);
```

---

### 7.9 getNetworkConfig()

Get DDC Chain network configuration.

**Method Signature:**

```typescript
public getNetworkConfig(): DDCChainConfig
```

**Parameters:**

- None

**Return Value:**

- `DDCChainConfig`: Network configuration object

**Example:**

```typescript
const network = manager.getNetworkConfig();
console.log(`Chain ID: ${network.chain_id}`);
console.log(`Chain Name: ${network.chain_name}`);
console.log(`RPC URL: ${network.rpc_url}`);
```

---

## 8. Utility Functions

### 8.1 getKeyHash()

Generate key hash (for mint, transfer, etc. operations).

**Method Signature:**

```typescript
export function getKeyHash(key: string): string;
```

**Parameters:**

- `key` (string): Key string

**Return Value:**

- `string`: Hash in bytes32 format (0x + 64 hex characters)

**Example:**

```typescript
import { getKeyHash } from '@ddc-market/sdk';

const keyHash = getKeyHash('your-secret-key');
console.log(`Key hash: ${keyHash}`);
// Output: 0x1234... (64 hex characters)
```

**Notes:**

- Uses keccak256 algorithm to generate hash
- Returned hash can be directly used for contract operations

---

## Complete Usage Flow Examples

### DDCNFT Complete Flow

```typescript
import { DDCNFTManager, getKeyHash } from '@ddc-market/sdk';
import { BrowserProvider } from 'ethers';

// 1. Initialize
const manager = await DDCNFTManager.init({
  walletAddress: '0x...',
  provider: new BrowserProvider(window.ethereum),
  debug: true,
});

// 2. Check factory contract
let factoryAddress = manager.getFactoryAddress();
if (!factoryAddress) {
  // 3. Deploy factory contract
  const factoryResult = await manager.deployFactory();
  factoryAddress = factoryResult.contractAddress;
  console.log(`Factory deployed: ${factoryAddress}`);
}

// 4. Deploy NFT contract
const nftResult = await manager.deployContract('MyNFT', 'MNFT');
const nftAddress = nftResult.contractAddress;
console.log(`NFT contract deployed: ${nftAddress}`);

// 5. Set current contract (if not automatically set after deployment)
manager.setContractAddress(nftAddress);

// 6. Mint NFT
const keyHash = getKeyHash('my-secret-key');
const mintTx = await manager.mint(BigInt(1), keyHash);
console.log(`Mint transaction: ${mintTx}`);

// 7. Query NFT information
const name = await manager.getName();
const symbol = await manager.getSymbol();
const ownerHash = await manager.getOwnerOf(BigInt(1));
const tokenURI = await manager.getTokenURI(BigInt(1));

// 8. Transfer NFT
const recipientHash = getKeyHash('recipient-secret-key');
const transferTx = await manager.transfer(recipientHash, BigInt(1), 'transfer-key');
console.log(`Transfer transaction: ${transferTx}`);

// 9. Destroy NFT
const destroyTx = await manager.destroy(BigInt(1), 'destroy-key');
console.log(`Destroy transaction: ${destroyTx}`);
```

### Membership Complete Flow

```typescript
import { MembershipManager, getKeyHash } from '@ddc-market/sdk';
import { BrowserProvider } from 'ethers';

// 1. Initialize
const manager = await MembershipManager.init({
  walletAddress: '0x...',
  provider: new BrowserProvider(window.ethereum),
  debug: true,
});

// 2. Check factory contract
let factoryAddress = manager.getFactoryAddress();
if (!factoryAddress) {
  // 3. Deploy factory contract
  const factoryResult = await manager.deployFactory();
  factoryAddress = factoryResult.contractAddress;
}

// 4. Deploy Membership contract
const membershipResult = await manager.deployContract('MyDAO', 'MDAO');
const membershipAddress = membershipResult.contractAddress;
manager.setContractAddress(membershipAddress);

// 5. Mint membership token
const memberHash = getKeyHash('member-address');
const mintResult = await manager.mintMembership(BigInt(1), memberHash);
console.log(`Token minted to: ${mintResult.to}`);

// 6. Create snapshot
const snapshotId = await manager.createSnapshot();
console.log(`Snapshot created: ${snapshotId}`);

// 7. Query snapshot members
const members = await manager.getMemberSnapshot(snapshotId);
console.log(`Snapshot has ${members.length} members`);

// 8. Check if member is in snapshot
const isMember = await manager.isMemberInSnapshot(snapshotId, memberHash);
console.log(`Is member: ${isMember}`);

// 9. Query total supply
const supply = await manager.getTotalSupply();
console.log(`Total supply: ${supply}`);

// 10. Destroy membership token
const destroyResult = await manager.destroyMembership(BigInt(1), memberHash);
console.log(`Token destroyed`);
```

---

## Important Notes

### Vue 3 Usage Notes

When using SDK in Vue 3, due to Vue's reactive Proxy system, directly calling Manager methods may cause `TypeError: Receiver must be an instance of class anonymous` error.

**Solution: Use `toRaw()`**

```typescript
import { toRaw } from 'vue';

// ❌ Wrong way
await nftManager.value.mint(BigInt(1), keyHash);

// ✅ Correct way
const rawManager = toRaw(nftManager.value);
await rawManager.mint(BigInt(1), keyHash);
```

### Provider Mode Selection

**BrowserProvider Mode:**

- Suitable for browser wallets (MetaMask, OKX, etc.)
- Users need to connect wallet first
- Transactions require user confirmation in wallet

**JsonRpcProvider Mode:**

- Suitable for backend services or scenarios requiring automated transactions
- Requires providing private key
- Transactions are automatically signed, no user confirmation needed

### Error Handling

All methods may throw `SDKError`, it's recommended to use try-catch:

```typescript
try {
  const result = await manager.deployContract('MyNFT', 'MNFT');
  console.log('Success:', result);
} catch (error) {
  if (error instanceof SDKError) {
    console.error('SDK Error:', error.message);
    console.error('Error Code:', error.code);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### Network Validation

SDK automatically validates network connection before critical operations:

- BrowserProvider: Automatically switches network (if configured)
- JsonRpcProvider: Directly trusts configured network (because it's fetched from API)

---

## Type Definitions

### ManagerParams

```typescript
interface ManagerParams {
  walletAddress: string;
  provider: BrowserProvider | JsonRpcProviderDescriptor;
  signer?: SignerConfig;
  debug?: boolean;
}
```

### SignerConfig

```typescript
interface SignerConfig {
  privateKey: string;
}
```

### DeploymentResult

```typescript
interface DeploymentResult {
  contractAddress: string;
  transactionHash: string;
  blockNumber: number;
}
```

### MintResult

```typescript
interface MintResult {
  tokenId: bigint;
  to: string;
  transactionHash: string;
  blockNumber: number;
}
```

### DestroyResult

```typescript
interface DestroyResult {
  tokenId: bigint;
  from: string;
  transactionHash: string;
  blockNumber: number;
}
```

---

## Common Error Codes

- `NETWORK_CONFIG_NOT_AVAILABLE`: Network configuration not available
- `PROVIDER_NOT_AVAILABLE`: Provider not available
- `NO_CONTRACT_ADDRESS`: Contract address not set
- `CONTRACT_NOT_DEPLOYED`: Contract not deployed
- `INSUFFICIENT_FUNDS`: Insufficient funds
- `USER_REJECTED`: User rejected transaction
- `CONTRACT_CALL_FAILED`: Contract call failed
- `INVALID_PARAMETER`: Invalid parameter
