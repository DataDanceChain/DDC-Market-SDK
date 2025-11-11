# DDC Market SDK API 文档

本文档按照使用流程顺序整理 SDK API，从初始化到合约操作的完整流程。

## 目录

- [1. 初始化](#1-初始化)
- [2. 工厂合约部署](#2-工厂合约部署)
- [3. 子合约部署](#3-子合约部署)
- [4. 合约选择与管理](#4-合约选择与管理)
- [5. DDCNFT 合约操作](#5-ddcnft-合约操作)
- [6. Membership 合约操作](#6-membership-合约操作)
- [7. 通用合约操作](#7-通用合约操作)
- [8. 工具函数](#8-工具函数)

---

## 1. 初始化

### 1.1 DDCNFTManager.init()

初始化 DDCNFT Manager 实例。

**方法签名：**

```typescript
static async init(manageConfig: ManagerParams): Promise<DDCNFTManager>
```

**参数：**

- `manageConfig` (ManagerParams)
  - `walletAddress` (string): 钱包地址
  - `provider` (BrowserProvider | JsonRpcProviderDescriptor): Provider 实例或描述符
    - BrowserProvider 模式：传入 `new BrowserProvider(window.ethereum)` 实例
    - JsonRpcProvider 模式：传入 `{ type: 'jsonRpc' }` 描述符
  - `signer` (SignerConfig, 可选): JsonRpcProvider 模式下必填
    - `privateKey` (string): 私钥
  - `debug` (boolean, 可选): 是否启用调试日志

**返回值：**

- `Promise<DDCNFTManager>`: Manager 实例

**示例：**

```typescript
// BrowserProvider 模式
import { BrowserProvider } from 'ethers';
import { getProvider, getSigner, getAddress, DDCNFTManager } from '@ddc-market/sdk';

const provider = getProvider(window.ethereum);
const manager: DDCNFTManager = await DDCNFTManager.init({
  walletAddress: '0x...',
  provider: provider,
  debug: true,
});

// JsonRpcProvider 模式
const manager = await DDCNFTManager.init({
  walletAddress: '0x...',
  provider: { type: 'jsonRpc' },
  signer: { privateKey: 'your_seceret_key' },
  debug: false,
});
```

**说明：**

- 初始化只需要全局唯一一个
- 初始化时会自动调用 API 获取网络配置
- JsonRpcProvider 模式下会自动从 API 获取 rpcUrl 和 chainId
- 如果已有工厂合约地址，会自动加载

---

### 1.2 MembershipManager.init()

初始化 Membership Manager 实例。

**方法签名：**

```typescript
static async init(manageConfig: ManagerParams): Promise<MembershipManager>
```

**参数：**

- 同 `DDCNFTManager.init()`

**返回值：**

- `Promise<MembershipManager>`: Manager 实例

**示例：**

```typescript
import { MembershipManager } from '@ddc-market/sdk';

// BrowserProvider 模式
const manager: MembershipManager = await MembershipManager.init({
  walletAddress: '0x...',
  provider: new BrowserProvider(window.ethereum),
  debug: true,
});

// JsonRpcProvider 模式
const manager = await MembershipManager.init({
  walletAddress: '0x...',
  provider: { type: 'jsonRpc' },
  signer: { privateKey: 'your_seceret_key' },
  debug: false,
});
```

---

## 2. 工厂合约部署

### 2.1 deployFactory()

部署工厂合约（DDCNFTFactory 或 MembershipFactory）。

**方法签名：**

```typescript
public async deployFactory(): Promise<DeploymentResult>
```

**参数：**

- 无

**返回值：**

- `Promise<DeploymentResult>`
  - `contractAddress` (string): 工厂合约地址
  - `transactionHash` (string): 交易哈希
  - `blockNumber` (number): 区块号

**示例：**

```typescript
import { DeploymentResult } from '@ddc-market/sdk';

// DDCNFT
const result: DeploymentResult = await ddcnftManager.deployFactory();
console.log(`Factory deployed at: ${result.contractAddress}`);

// Membership
const result = await membershipManager.deployFactory();
console.log(`Factory deployed at: ${result.contractAddress}`);
```

**说明：**

- 工厂合约暂时只支持部署一个地址!
- 部署前会自动验证网络连接
- 需要足够的 gas 费用
- 部署成功后会自动上报工厂地址到后端

---

### 2.2 getFactoryAddress()

获取工厂合约地址。

**方法签名：**

```typescript
public getFactoryAddress(): string
```

**返回值：**

- `string`: 工厂合约地址（如果未部署则返回空字符串）

**示例：**

```typescript
const factoryAddress = manager.getFactoryAddress();
if (factoryAddress) {
  console.log(`Factory address: ${factoryAddress}`);
} else {
  console.log('Factory not deployed yet');
}
```

---

## 3. 子合约部署

### 3.1 deployContract()

通过工厂合约部署子合约（DDCNFT 或 Membership）。

**方法签名：**

```typescript
public async deployContract(name: string, symbol: string): Promise<DeploymentResult>
```

**参数：**

- `name` (string): 合约名称（不能为空）
- `symbol` (string): 合约符号（不能为空）

**返回值：**

- `Promise<DeploymentResult>`
  - `contractAddress` (string): 部署的合约地址
  - `transactionHash` (string): 交易哈希
  - `blockNumber` (number): 区块号

**示例：**

```typescript
import { DeploymentResult } from '@ddc-market/sdk';

// 部署 DDCNFT 合约
const result: DeploymentResult = await ddcnftManager.deployContract('MyNFT', 'MNFT');
console.log(`NFT contract deployed at: ${result.contractAddress}`);

// 部署 Membership 合约
const result = await membershipManager.deployContract('MyDAO', 'MDAO');
console.log(`Membership contract deployed at: ${result.contractAddress}`);
```

**说明：**

- 部署前需要先部署工厂合约
- 部署前会自动验证网络连接
- 部署成功后会自动设置为当前活动合约
- 部署的合约地址会自动添加到已部署合约列表

---

### 3.3 getAllDeployedAddresses()

获取所有已部署的合约地址列表。

**方法签名：**

```typescript
public getAllDeployedAddresses(): ReadonlyArray<string>
```

**返回值：**

- `ReadonlyArray<string>`: 已部署合约地址数组

**示例：**

```typescript
const contracts = manager.getAllDeployedAddresses();
console.log(`Found ${contracts.length} deployed contracts`);
contracts.forEach((address, index) => {
  console.log(`${index + 1}. ${address}`);
});
```

---

## 4. 合约选择与管理

### 4.1 setContractAddress()

设置当前活动的合约地址。

**方法签名：**

```typescript
public setContractAddress(address: string): void
```

**参数：**

- `address` (string): 合约地址

**示例：**

```typescript
manager.setContractAddress('0x1234...');
```

**说明：**

- 设置后，后续的合约操作都会使用这个地址
- 地址会被验证格式

---

### 4.2 getContractAddress()

获取当前活动的合约地址。

**方法签名：**

```typescript
public getContractAddress(): string | undefined
```

**返回值：**

- `string | undefined`: 当前合约地址，如果未设置则返回 `undefined`

**示例：**

```typescript
const address = manager.getContractAddress();
if (address) {
  console.log(`Current contract: ${address}`);
}
```

---

### 4.3 getContract()

获取合约实例（用于直接调用合约方法）。

**方法签名：**

```typescript
public async getContract(contractAddress?: string): Promise<Contract>
```

**参数：**

- `contractAddress` (string, 可选): 合约地址，如果不提供则使用当前设置的地址

**返回值：**

- `Promise<Contract>`: ethers Contract 实例

**示例：**

```typescript
// 使用当前设置的合约地址
const contract = await manager.getContract();

// 使用指定的合约地址
const contract = await manager.getContract('0x1234...');
```

**说明：**

- 返回的 Contract 实例已连接 signer，可以直接调用合约方法
- 注意：在 Vue 3 中使用时，需要使用 `toRaw()` 避免 Proxy 问题

---

## 5. DDCNFT 合约操作

### 5.1 mint()

铸造 NFT。

**方法签名：**

```typescript
public async mint(tokenId: bigint, keyHash: string): Promise<string>
```

**参数：**

- `tokenId` (bigint): Token ID（必须非零）
- `keyHash` (string): Key hash（bytes32 格式，0x + 64 个十六进制字符，不能为零值）

**返回值：**

- `Promise<string>`: 交易哈希

**示例：**

```typescript
import { getKeyHash } from '@ddc-market/sdk';

// 生成 keyHash
const keyHash = getKeyHash('your-secret-key');

// 铸造 NFT
const txHash = await ddcnftManager.mint(BigInt(1), keyHash);
console.log(`Mint transaction: ${txHash}`);
```

**说明：**

- 需要先设置合约地址
- keyHash 可以通过 `getKeyHash()` 工具函数生成
- 铸造的 NFT 会归属于调用者（合约 owner）

---

### 5.2 transfer()

转移 NFT。

**方法签名：**

```typescript
public async transfer(toHash: string, tokenId: bigint, key: string): Promise<string>
```

**参数：**

- `toHash` (string): 接收方地址 hash（bytes32 格式）
- `tokenId` (bigint): Token ID
- `key` (string): 转移密钥（不能为空）

**返回值：**

- `Promise<string>`: 交易哈希

**示例：**

```typescript
import { getKeyHash } from '@ddc-market/sdk';

// 生成接收方的 hash
const recipientHash = getKeyHash('recipient-secret-key');

// 转移 NFT
const txHash = await ddcnftManager.transfer(recipientHash, BigInt(1), 'your-transfer-key');
console.log(`Transfer transaction: ${txHash}`);
```

**说明：**

- 需要先设置合约地址
- 需要拥有该 token 的所有权
- key 是转移时使用的密钥

---

### 5.3 destroy()

销毁（销毁）NFT。

**方法签名：**

```typescript
public async destroy(tokenId: bigint, key: string): Promise<string>
```

**参数：**

- `tokenId` (bigint): Token ID
- `key` (string): 销毁密钥（不能为空）

**返回值：**

- `Promise<string>`: 交易哈希

**示例：**

```typescript
const txHash = await ddcnftManager.destroy(BigInt(1), 'your-destroy-key');
console.log(`Destroy transaction: ${txHash}`);
```

**说明：**

- 需要先设置合约地址
- 需要拥有该 token 的所有权
- 销毁后 token 将永久消失

---

### 5.4 pause()

暂停合约（仅合约 owner 可调用）。

**方法签名：**

```typescript
public async pause(): Promise<string>
```

**参数：**

- 无

**返回值：**

- `Promise<string>`: 交易哈希

**示例：**

```typescript
const txHash = await ddcnftManager.pause();
console.log(`Pause transaction: ${txHash}`);
```

---

### 5.5 unpause()

取消暂停合约（仅合约 owner 可调用）。

**方法签名：**

```typescript
public async unpause(): Promise<string>
```

**参数：**

- 无

**返回值：**

- `Promise<string>`: 交易哈希

**示例：**

```typescript
const txHash = await ddcnftManager.unpause();
console.log(`Unpause transaction: ${txHash}`);
```

---

## 6. Membership 合约操作

### 6.1 mintMembership()

铸造会员代币。

**方法签名：**

```typescript
public async mintMembership(tokenId: bigint, addressHash: string): Promise<MintResult>
```

**参数：**

- `tokenId` (bigint): Token ID
- `addressHash` (string): 会员地址 hash（bytes32 格式，不能为零值）

**返回值：**

- `Promise<MintResult>`
  - `tokenId` (bigint): Token ID
  - `to` (string): 接收方地址 hash
  - `transactionHash` (string): 交易哈希
  - `blockNumber` (number): 区块号

**示例：**

```typescript
import { getKeyHash } from '@ddc-market/sdk';

// 生成会员地址 hash
const memberHash = getKeyHash('member-address-or-key');

// 铸造会员代币
const result = await membershipManager.mintMembership(BigInt(1), memberHash);
console.log(`Token minted to: ${result.to}`);
console.log(`Transaction: ${result.transactionHash}`);
```

---

### 6.2 destroyMembership()

销毁（兑换）会员代币。

**方法签名：**

```typescript
public async destroyMembership(tokenId: bigint, addressHash: string): Promise<DestroyResult>
```

**参数：**

- `tokenId` (bigint): Token ID
- `addressHash` (string): 会员地址 hash（bytes32 格式）

**返回值：**

- `Promise<DestroyResult>`
  - `tokenId` (bigint): Token ID
  - `from` (string): 原拥有者地址 hash
  - `transactionHash` (string): 交易哈希
  - `blockNumber` (number): 区块号

**示例：**

```typescript
import { getKeyHash } from '@ddc-market/sdk';

const memberHash = getKeyHash('member-address');
const result = await membershipManager.destroyMembership(BigInt(1), memberHash);
console.log(`Token destroyed. Previous owner: ${result.from}`);
```

---

### 6.3 createSnapshot()

创建会员快照。

**方法签名：**

```typescript
public async createSnapshot(): Promise<bigint>
```

**参数：**

- 无

**返回值：**

- `Promise<bigint>`: 快照 ID

**示例：**

```typescript
const snapshotId = await membershipManager.createSnapshot();
console.log(`Snapshot created with ID: ${snapshotId}`);
```

**说明：**

- 快照会记录当前所有会员的地址 hash
- 快照 ID 从 1 开始递增

---

### 6.4 getMemberSnapshot()

获取快照中的会员列表。

**方法签名：**

```typescript
public async getMemberSnapshot(snapshotId: bigint): Promise<string[]>
```

**参数：**

- `snapshotId` (bigint): 快照 ID

**返回值：**

- `Promise<string[]>`: 会员地址 hash 数组

**示例：**

```typescript
const members = await membershipManager.getMemberSnapshot(BigInt(1));
console.log(`Snapshot has ${members.length} members`);
members.forEach((member, index) => {
  console.log(`Member ${index + 1}: ${member}`);
});
```

**说明：**

- 如果快照不存在，返回空数组

---

### 6.5 getLatestSnapshotId()

获取最新快照 ID。

**方法签名：**

```typescript
public async getLatestSnapshotId(): Promise<bigint>
```

**参数：**

- 无

**返回值：**

- `Promise<bigint>`: 最新快照 ID（如果没有快照则返回 0）

**示例：**

```typescript
const latestId = await membershipManager.getLatestSnapshotId();
console.log(`Latest snapshot ID: ${latestId}`);
```

---

### 6.6 isMemberInSnapshot()

检查会员是否在快照中。

**方法签名：**

```typescript
public async isMemberInSnapshot(snapshotId: bigint, addressHash: string): Promise<boolean>
```

**参数：**

- `snapshotId` (bigint): 快照 ID
- `addressHash` (string): 会员地址 hash

**返回值：**

- `Promise<boolean>`: 是否在快照中

**示例：**

```typescript
import { getKeyHash } from '@ddc-market/sdk';

const memberHash = getKeyHash('member-address');
const isMember = await membershipManager.isMemberInSnapshot(BigInt(1), memberHash);
console.log(`Is member: ${isMember}`);
```

---

### 6.7 getTotalSupply()

获取会员代币总供应量。

**方法签名：**

```typescript
public async getTotalSupply(): Promise<bigint>
```

**参数：**

- 无

**返回值：**

- `Promise<bigint>`: 总供应量

**示例：**

```typescript
const supply = await membershipManager.getTotalSupply();
console.log(`Total supply: ${supply}`);
```

---

## 7. 通用合约操作

### 7.1 getName()

获取合约名称。

**方法签名：**

```typescript
public async getName(): Promise<string>
```

**参数：**

- 无

**返回值：**

- `Promise<string>`: 合约名称

**示例：**

```typescript
const name = await manager.getName();
console.log(`Contract name: ${name}`);
```

---

### 7.2 getSymbol()

获取合约符号。

**方法签名：**

```typescript
public async getSymbol(): Promise<string>
```

**参数：**

- 无

**返回值：**

- `Promise<string>`: 合约符号

**示例：**

```typescript
const symbol = await manager.getSymbol();
console.log(`Contract symbol: ${symbol}`);
```

---

### 7.3 getOwner()

获取合约拥有者地址。

**方法签名：**

```typescript
public async getOwner(): Promise<string>
```

**参数：**

- 无

**返回值：**

- `Promise<string>`: 拥有者地址

**示例：**

```typescript
const owner = await manager.getOwner();
console.log(`Contract owner: ${owner}`);
```

---

### 7.4 getOwnerOf()

获取 Token 的拥有者（hash）。

**方法签名：**

```typescript
public async getOwnerOf(tokenId: bigint): Promise<string>
```

**参数：**

- `tokenId` (bigint): Token ID

**返回值：**

- `Promise<string>`: 拥有者地址 hash（bytes32）

**示例：**

```typescript
const ownerHash = await manager.getOwnerOf(BigInt(1));
console.log(`Token owner hash: ${ownerHash}`);
```

---

### 7.5 getTokenURI()

获取 Token URI。

**方法签名：**

```typescript
public async getTokenURI(tokenId: bigint): Promise<string>
```

**参数：**

- `tokenId` (bigint): Token ID

**返回值：**

- `Promise<string>`: Token URI

**示例：**

```typescript
const uri = await manager.getTokenURI(BigInt(1));
console.log(`Token URI: ${uri}`);
```

**说明：**

- 注意: DDC 默认提供 OSS 服务存储 Metadata, 是 OSS 的根服务域名
- 有隐私需求需要部署完合约后, 手动设置 Metadata URI !

---

### 7.6 setBaseURI()

设置基础 URI（仅合约 owner 可调用）。

**方法签名：**

```typescript
public async setBaseURI(baseURI: string): Promise<void>
```

**参数：**

- `baseURI` (string): 基础 URI

**返回值：**

- `Promise<void>`

**示例：**

```typescript
await manager.setBaseURI(`https://api.example.com/metadata/${contractAddress}/`);
```

**说明：**

- 注意: 设置路径规则是: OSS 的根服务域名 + 当前合约地址 (Metadata 信息存放的文件夹目录名)

---

### 7.7 transferOwnership()

转移合约所有权（仅合约 owner 可调用）。

**方法签名：**

```typescript
public async transferOwnership(newOwner: string): Promise<string>
```

**参数：**

- `newOwner` (string): 新拥有者地址

**返回值：**

- `Promise<string>`: 交易哈希

**示例：**

```typescript
const txHash = await manager.transferOwnership('0x...');
console.log(`Ownership transferred: ${txHash}`);
```

---

### 7.8 getDefaultMetadataURL()

获取默认元数据 URL (DDC 默认提供的 URI)。

**方法签名：**

```typescript
public getDefaultMetadataURL(): string
```

**参数：**

- 无

**返回值：**

- `string`: 默认元数据 URL

**示例：**

```typescript
const metadataUrl = manager.getDefaultMetadataURL();
console.log(`Default metadata URL: ${metadataUrl}`);
```

---

### 7.9 getNetworkConfig()

获取 DDC Chain 网络配置。

**方法签名：**

```typescript
public getNetworkConfig(): DDCChainConfig
```

**参数：**

- 无

**返回值：**

- `DDCChainConfig`: 网络配置对象

**示例：**

```typescript
const network = manager.getNetworkConfig();
console.log(`Chain ID: ${network.chain_id}`);
console.log(`Chain Name: ${network.chain_name}`);
console.log(`RPC URL: ${network.rpc_url}`);
```

---

## 8. 工具函数

### 8.1 getKeyHash()

生成 key hash（用于 mint、transfer 等操作）。

**方法签名：**

```typescript
export function getKeyHash(key: string): string;
```

**参数：**

- `key` (string): 密钥字符串

**返回值：**

- `string`: bytes32 格式的 hash（0x + 64 个十六进制字符）

**示例：**

```typescript
import { getKeyHash } from '@ddc-market/sdk';

const keyHash = getKeyHash('your-secret-key');
console.log(`Key hash: ${keyHash}`);
// 输出: 0x1234... (64 个十六进制字符)
```

**说明：**

- 使用 keccak256 算法生成 hash
- 返回的 hash 可以直接用于合约操作

---

## 完整使用流程示例

### DDCNFT 完整流程

```typescript
import { DDCNFTManager, getKeyHash } from '@ddc-market/sdk';
import { BrowserProvider } from 'ethers';

// 1. 初始化
const manager = await DDCNFTManager.init({
  walletAddress: '0x...',
  provider: new BrowserProvider(window.ethereum),
  debug: true,
});

// 2. 检查工厂合约
let factoryAddress = manager.getFactoryAddress();
if (!factoryAddress) {
  // 3. 部署工厂合约
  const factoryResult = await manager.deployFactory();
  factoryAddress = factoryResult.contractAddress;
  console.log(`Factory deployed: ${factoryAddress}`);
}

// 4. 部署 NFT 合约
const nftResult = await manager.deployContract('MyNFT', 'MNFT');
const nftAddress = nftResult.contractAddress;
console.log(`NFT contract deployed: ${nftAddress}`);

// 5. 设置当前合约（如果部署后未自动设置）
manager.setContractAddress(nftAddress);

// 6. 铸造 NFT
const keyHash = getKeyHash('my-secret-key');
const mintTx = await manager.mint(BigInt(1), keyHash);
console.log(`Mint transaction: ${mintTx}`);

// 7. 查询 NFT 信息
const name = await manager.getName();
const symbol = await manager.getSymbol();
const ownerHash = await manager.getOwnerOf(BigInt(1));
const tokenURI = await manager.getTokenURI(BigInt(1));

// 8. 转移 NFT
const recipientHash = getKeyHash('recipient-secret-key');
const transferTx = await manager.transfer(recipientHash, BigInt(1), 'transfer-key');
console.log(`Transfer transaction: ${transferTx}`);

// 9. 销毁 NFT
const destroyTx = await manager.destroy(BigInt(1), 'destroy-key');
console.log(`Destroy transaction: ${destroyTx}`);
```

### Membership 完整流程

```typescript
import { MembershipManager, getKeyHash } from '@ddc-market/sdk';
import { BrowserProvider } from 'ethers';

// 1. 初始化
const manager = await MembershipManager.init({
  walletAddress: '0x...',
  provider: new BrowserProvider(window.ethereum),
  debug: true,
});

// 2. 检查工厂合约
let factoryAddress = manager.getFactoryAddress();
if (!factoryAddress) {
  // 3. 部署工厂合约
  const factoryResult = await manager.deployFactory();
  factoryAddress = factoryResult.contractAddress;
}

// 4. 部署 Membership 合约
const membershipResult = await manager.deployContract('MyDAO', 'MDAO');
const membershipAddress = membershipResult.contractAddress;
manager.setContractAddress(membershipAddress);

// 5. 铸造会员代币
const memberHash = getKeyHash('member-address');
const mintResult = await manager.mintMembership(BigInt(1), memberHash);
console.log(`Token minted to: ${mintResult.to}`);

// 6. 创建快照
const snapshotId = await manager.createSnapshot();
console.log(`Snapshot created: ${snapshotId}`);

// 7. 查询快照成员
const members = await manager.getMemberSnapshot(snapshotId);
console.log(`Snapshot has ${members.length} members`);

// 8. 检查会员是否在快照中
const isMember = await manager.isMemberInSnapshot(snapshotId, memberHash);
console.log(`Is member: ${isMember}`);

// 9. 查询总供应量
const supply = await manager.getTotalSupply();
console.log(`Total supply: ${supply}`);

// 10. 销毁会员代币
const destroyResult = await manager.destroyMembership(BigInt(1), memberHash);
console.log(`Token destroyed`);
```

---

## 注意事项

### Vue 3 使用注意事项

在 Vue 3 中使用 SDK 时，由于 Vue 的响应式 Proxy 系统，直接调用 Manager 方法可能会导致 `TypeError: Receiver must be an instance of class anonymous` 错误。

**解决方案：使用 `toRaw()`**

```typescript
import { toRaw } from 'vue';

// ❌ 错误方式
await nftManager.value.mint(BigInt(1), keyHash);

// ✅ 正确方式
const rawManager = toRaw(nftManager.value);
await rawManager.mint(BigInt(1), keyHash);
```

### Provider 模式选择

**BrowserProvider 模式：**

- 适用于浏览器钱包（MetaMask、OKX 等）
- 用户需要先连接钱包
- 交易需要用户在钱包中确认

**JsonRpcProvider 模式：**

- 适用于后端服务或需要自动化交易的场景
- 需要提供私钥
- 交易自动签名，无需用户确认

### 错误处理

所有方法都可能抛出 `SDKError`，建议使用 try-catch 处理：

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

### 网络验证

SDK 会在关键操作前自动验证网络连接：

- BrowserProvider：会自动切换网络（如果配置了）
- JsonRpcProvider：直接信任配置的网络（因为是从 API 获取的）

---

## 类型定义

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

## 常见错误码

- `NETWORK_CONFIG_NOT_AVAILABLE`: 网络配置不可用
- `PROVIDER_NOT_AVAILABLE`: Provider 不可用
- `NO_CONTRACT_ADDRESS`: 未设置合约地址
- `CONTRACT_NOT_DEPLOYED`: 合约未部署
- `INSUFFICIENT_FUNDS`: 余额不足
- `USER_REJECTED`: 用户拒绝交易
- `CONTRACT_CALL_FAILED`: 合约调用失败
- `INVALID_PARAMETER`: 参数无效
