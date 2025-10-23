# DDC Market SDK - 用户使用指南

## 目录
- [快速开始](#快速开始)
- [获取 Signer 的三种方式](#获取-signer-的三种方式)
  - [方式 1: Node.js 环境（使用私钥）](#方式-1-nodejs-环境使用私钥)
  - [方式 2: 浏览器 + MetaMask](#方式-2-浏览器--metamask)
  - [方式 3: MetaMask Embedded Wallets (Web3Auth)](#方式-3-metamask-embedded-wallets-web3auth)
- [SDK API 使用](#sdk-api-使用)
- [常见问题](#常见问题)

---

## 快速开始

### 安装

```bash
npm install @ddc-market/sdk ethers
```

### 核心概念

DDC Market SDK 需要一个 **Signer** 来执行合约操作（部署、铸造、转账等）。

**重要：**
- ✅ **推荐使用 Signer** - 可以读取和写入区块链
- ⚠️ Provider（只读） - 只能读取，不能签名交易

---

## 获取 Signer 的三种方式

### 方式 1: Node.js 环境（使用私钥）

**适用场景：** 后端服务、脚本、自动化任务

```typescript
import { ethers } from 'ethers';
import { DDCNFTManager } from '@ddc-market/sdk';

// 1. 创建 Provider（连接到区块链）
const provider = new ethers.JsonRpcProvider('https://your-rpc-url');

// 2. 创建 Signer（使用私钥）
const signer = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

// 3. 初始化 SDK Manager
const ddcnftManager = new DDCNFTManager({
  runner: signer,  // 传入 Signer
  factoryAddress: '0xYourFactoryAddress',
  debug: true,
});

// 4. 使用 SDK
async function main() {
  console.log('Wallet address:', await signer.getAddress());

  // 部署 NFT 合约
  const deployment = await ddcnftManager.deployDDCNFT('MyNFT', 'MNFT');
  console.log('Contract deployed at:', deployment.contractAddress);
}

main().catch(console.error);
```

---

### 方式 2: 浏览器 + MetaMask

**适用场景：** Web 应用、DApp 前端

#### 2.1 基础用法（手动连接）

```typescript
import { ethers } from 'ethers';
import { DDCNFTManager } from '@ddc-market/sdk';

async function connectWithMetaMask() {
  // 1. 检查 MetaMask 是否安装
  if (!window.ethereum) {
    alert('请安装 MetaMask!');
    return;
  }

  // 2. 请求用户连接钱包
  await window.ethereum.request({ method: 'eth_requestAccounts' });

  // 3. 创建 Provider（从 MetaMask）
  const provider = new ethers.BrowserProvider(window.ethereum);

  // 4. 获取 Signer（⚠️ ethers v6 必须 await）
  const signer = await provider.getSigner();

  // 5. 初始化 SDK
  const ddcnftManager = new DDCNFTManager({
    runner: signer,  // 传入 Signer
    factoryAddress: '0xYourFactoryAddress',
  });

  // 6. 使用 SDK
  const address = await signer.getAddress();
  console.log('Connected address:', address);

  // 部署合约
  const deployment = await ddcnftManager.deployDDCNFT('MyNFT', 'MNFT');
  console.log('Deployed at:', deployment.contractAddress);
}

// 用户点击按钮时调用
document.getElementById('connectButton')?.addEventListener('click', connectWithMetaMask);
```

#### 2.2 使用 SDK 提供的工具函数（推荐）

```typescript
import { DDCNFTManager } from '@ddc-market/sdk';
import { getProvider, getSigner } from '@ddc-market/sdk/utils';

async function connectSimple() {
  try {
    // 1. 获取 Provider（自动检测 window.ethereum）
    const provider = await getProvider();

    // 2. 获取 Signer
    const signer = await getSigner(provider);

    // 3. 初始化 SDK
    const ddcnftManager = new DDCNFTManager({
      runner: signer,
      factoryAddress: '0xYourFactoryAddress',
    });

    console.log('Connected:', await signer.getAddress());
    return ddcnftManager;
  } catch (error) {
    if (error.message.includes('No wallet provider')) {
      alert('请安装 MetaMask 或其他钱包');
    } else if (error.message.includes('rejected')) {
      alert('用户拒绝了连接请求');
    }
    throw error;
  }
}
```

#### 2.3 React 示例

```tsx
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { DDCNFTManager } from '@ddc-market/sdk';

function App() {
  const [manager, setManager] = useState<DDCNFTManager | null>(null);
  const [address, setAddress] = useState<string>('');

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('请安装 MetaMask');
      return;
    }

    try {
      // 请求连接
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      // 创建 provider 和 signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // 初始化 SDK
      const ddcnftManager = new DDCNFTManager({
        runner: signer,
        factoryAddress: process.env.REACT_APP_FACTORY_ADDRESS!,
      });

      setManager(ddcnftManager);
      setAddress(await signer.getAddress());
    } catch (error) {
      console.error('连接失败:', error);
    }
  };

  const deployNFT = async () => {
    if (!manager) return;

    try {
      const result = await manager.deployDDCNFT('MyNFT', 'MNFT');
      alert(`合约已部署: ${result.contractAddress}`);
    } catch (error) {
      console.error('部署失败:', error);
    }
  };

  return (
    <div>
      {!address ? (
        <button onClick={connectWallet}>连接 MetaMask</button>
      ) : (
        <div>
          <p>已连接: {address}</p>
          <button onClick={deployNFT}>部署 NFT 合约</button>
        </div>
      )}
    </div>
  );
}
```

---

### 方式 3: MetaMask Embedded Wallets (Web3Auth)

**适用场景：** 需要社交登录（Google、Twitter 等）的 DApp

#### 3.1 安装依赖

```bash
npm install @web3auth/modal ethers
```

#### 3.2 完整示例

```typescript
import { Web3Auth, WEB3AUTH_NETWORK } from '@web3auth/modal';
import { ethers } from 'ethers';
import { DDCNFTManager } from '@ddc-market/sdk';

class Web3AuthManager {
  private web3auth: Web3Auth | null = null;
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;

  async init() {
    // 1. 创建 Web3Auth 实例
    this.web3auth = new Web3Auth({
      clientId: 'YOUR_WEB3AUTH_CLIENT_ID', // 从 https://dashboard.web3auth.io 获取
      web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
      chainConfig: {
        chainNamespace: 'eip155',
        chainId: '0x1', // Ethereum Mainnet (或其他链)
        rpcTarget: 'https://rpc.ankr.com/eth',
        displayName: 'Ethereum Mainnet',
        blockExplorerUrl: 'https://etherscan.io',
        ticker: 'ETH',
        tickerName: 'Ethereum',
      },
    });

    // 2. 初始化 Web3Auth
    await this.web3auth.initModal();
    console.log('✅ Web3Auth 初始化成功');
  }

  async connect() {
    if (!this.web3auth) {
      throw new Error('请先调用 init()');
    }

    // 3. 连接（弹出登录界面，支持 Google、Twitter 等）
    const web3authProvider = await this.web3auth.connect();

    if (!web3authProvider) {
      throw new Error('连接失败');
    }

    // 4. 创建 ethers Provider
    this.provider = new ethers.BrowserProvider(web3authProvider);

    // 5. 获取 Signer（⚠️ ethers v6 必须 await）
    this.signer = await this.provider.getSigner();

    console.log('✅ 已连接钱包:', await this.signer.getAddress());

    // 6. 获取用户信息（Web3Auth 特有功能）
    const userInfo = await this.web3auth.getUserInfo();
    console.log('👤 用户信息:', {
      email: userInfo.email,
      name: userInfo.name,
      profileImage: userInfo.profileImage,
    });

    return this.signer;
  }

  async disconnect() {
    if (this.web3auth) {
      await this.web3auth.logout();
      this.provider = null;
      this.signer = null;
      console.log('✅ 已断开连接');
    }
  }

  getSigner() {
    if (!this.signer) {
      throw new Error('请先连接钱包');
    }
    return this.signer;
  }
}

// 使用示例
async function main() {
  const web3AuthManager = new Web3AuthManager();

  // 初始化
  await web3AuthManager.init();

  // 连接（用户会看到登录界面）
  const signer = await web3AuthManager.connect();

  // 初始化 DDC Market SDK
  const ddcnftManager = new DDCNFTManager({
    runner: signer,  // 传入从 Web3Auth 获取的 Signer
    factoryAddress: '0xYourFactoryAddress',
  });

  // 使用 SDK
  const deployment = await ddcnftManager.deployDDCNFT('MyNFT', 'MNFT');
  console.log('🎉 合约部署成功:', deployment.contractAddress);

  // 断开连接
  // await web3AuthManager.disconnect();
}
```

#### 3.3 使用 SDK 的工具函数（更简单）

```typescript
import { Web3Auth } from '@web3auth/modal';
import { DDCNFTManager } from '@ddc-market/sdk';
import { getProvider, getSigner } from '@ddc-market/sdk/utils';

async function connectWeb3Auth() {
  // 1. 创建并初始化 Web3Auth
  const web3auth = new Web3Auth({
    clientId: 'YOUR_CLIENT_ID',
    // ... 其他配置
  });

  await web3auth.initModal();
  await web3auth.connect();

  // 2. 使用 SDK 工具函数获取 provider 和 signer
  const provider = await getProvider({ web3auth });
  const signer = await getSigner({ web3auth });

  // 3. 初始化 SDK
  const manager = new DDCNFTManager({
    runner: signer,
    factoryAddress: '0xYourFactoryAddress',
  });

  return manager;
}
```

---

## SDK API 使用

### DDCNFTManager

#### 初始化

```typescript
import { DDCNFTManager } from '@ddc-market/sdk';

const manager = new DDCNFTManager({
  runner: signer,           // 必需：Signer 对象
  factoryAddress: '0x...',  // 可选：工厂合约地址（如需部署新合约）
  debug: true,              // 可选：开启调试日志
});
```

#### 部署 NFT 合约

```typescript
const deployment = await manager.deployDDCNFT(
  'My NFT Collection',  // 合约名称
  'MNFT'                // 合约符号
);

console.log('Contract address:', deployment.contractAddress);
console.log('Transaction hash:', deployment.transactionHash);
console.log('Block number:', deployment.blockNumber);
```

#### 铸造 NFT

```typescript
const mintResult = await manager.mint(
  '0xNFTContractAddress',  // NFT 合约地址
  {
    to: '0xRecipientAddress',
    tokenId: 1n,  // bigint 类型
    metadata: {
      name: 'Genesis NFT',
      description: 'First NFT in collection',
      image: 'https://example.com/image.png',
      attributes: [
        { trait_type: 'Rarity', value: 'Legendary' },
        { trait_type: 'Generation', value: 1 },
      ],
    },
  }
);
```

#### 转账 NFT

```typescript
await manager.transfer(
  '0xNFTContractAddress',
  '0xRecipientAddress',
  1n  // tokenId
);
```

#### 查询 Token URI

```typescript
const tokenURI = await manager.getTokenURI(
  '0xNFTContractAddress',
  1n  // tokenId
);
console.log('Token metadata URI:', tokenURI);
```

---

## 常见问题

### Q1: 为什么提示 "missing signer" 错误？

**原因：** 你传入的是 Provider（只读），而不是 Signer。

**解决方案：**
```typescript
// ❌ 错误 - 只传入 Provider
const provider = new ethers.JsonRpcProvider('...');
const manager = new DDCNFTManager({ runner: provider });

// ✅ 正确 - 传入 Signer
const provider = new ethers.JsonRpcProvider('...');
const signer = new ethers.Wallet('PRIVATE_KEY', provider);
const manager = new DDCNFTManager({ runner: signer });
```

### Q2: Ethers.js v6 和 v5 有什么区别？

主要区别：
- `Web3Provider` → `BrowserProvider`
- `provider.getSigner()` → `await provider.getSigner()` （必须 await）
- `ethers.utils.parseEther()` → `ethers.parseEther()`

### Q3: 如何在 React 中处理钱包切换？

```typescript
useEffect(() => {
  if (!window.ethereum) return;

  // 监听账户切换
  window.ethereum.on('accountsChanged', async (accounts) => {
    if (accounts.length === 0) {
      // 用户断开连接
      setManager(null);
    } else {
      // 重新初始化
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      setManager(new DDCNFTManager({ runner: signer, ... }));
    }
  });

  // 监听链切换
  window.ethereum.on('chainChanged', () => {
    window.location.reload();
  });
}, []);
```

### Q4: Web3Auth 如何获取 Client ID？

1. 访问 https://dashboard.web3auth.io
2. 注册/登录账号
3. 创建新项目
4. 复制 Client ID

### Q5: 如何选择使用哪种连接方式？

| 场景 | 推荐方式 | 原因 |
|------|---------|------|
| 后端服务、脚本 | 私钥方式 | 简单直接，适合自动化 |
| Web3 用户（有钱包） | MetaMask | 用户已有钱包，体验最好 |
| Web2 用户（无钱包） | Web3Auth | 支持社交登录，降低门槛 |

### Q6: 如何处理错误？

```typescript
try {
  const deployment = await manager.deployDDCNFT('MyNFT', 'MNFT');
} catch (error) {
  if (error.code === 'SIGNER_REQUIRED') {
    console.error('需要 Signer，但提供的是 Provider');
  } else if (error.code === 'ACTION_REJECTED') {
    console.error('用户拒绝了交易');
  } else if (error.code === 'INSUFFICIENT_FUNDS') {
    console.error('账户余额不足');
  } else {
    console.error('未知错误:', error);
  }
}
```

---

## 更多资源

- [SDK GitHub 仓库](https://github.com/DataDanceChain/DDC-Market-SDK)
- [示例代码](./examples/)
- [API 文档](./docs/API.md)
- [Web3Auth 文档](https://docs.metamask.io/embedded-wallets/)
- [Ethers.js v6 文档](https://docs.ethers.org/v6/)

---

**需要帮助？** 请在 GitHub 上提交 Issue 或联系开发团队。
