<script setup lang="ts">
/**
 * Web3AuthConnector Component (Refactored with Composables)
 *
 * Using Web3Auth Vue Composables for Provider pattern integration
 * Features:
 * 1. Connect wallet via Web3Auth (social login support)
 * 2. Display connection status and wallet address
 * 3. Export private key functionality
 * 4. Integrated with Pinia wallet store
 */

import { ref, watch, markRaw } from 'vue';
import { BrowserProvider } from 'ethers';
import { useWeb3Auth, useSwitchChain } from '@web3auth/modal/vue';
import { useWalletStore } from '../../stores/wallet';
import { useWeb3AuthConnect, useWeb3AuthDisconnect, useWeb3AuthUser } from '@web3auth/modal/vue';
import { useAccount } from '@wagmi/vue';
import { getSigner, getProvider } from '@ddcmarket/sdk';

// ============================================================================
// Web3Auth Hooks
// ============================================================================
const { isInitializing, provider, status, initError } = useWeb3Auth();

// Login
const { connect, isConnected, connectorName, loading: connectLoading } = useWeb3AuthConnect();

// Logout
const { disconnect } = useWeb3AuthDisconnect();

// User Info
const { userInfo, isMFAEnabled, getUserInfo } = useWeb3AuthUser();

// Wagmi Account
const { address } = useAccount();

const { switchChain, error: switchChainError, loading: switchChainLoading } = useSwitchChain();

// ============================================================================
// State Management
// ============================================================================
const walletStore = useWalletStore();
const walletProvider = ref<BrowserProvider | null>(null);
const walletSigner = ref<any>(null); // Store signer reference
const walletAddress = ref<string>('');
const walletPrivateKey = ref<string>('');
const initializationError = ref<string>('');

// ============================================================================
// Provider Initialization (Safe Method)
// ============================================================================

/**
 * ✅ 安全的 Provider 初始化函数
 * 解决 `Cannot read private member #notReady` 错误
 */
async function initializeProvider() {
  initializationError.value = '';

  try {
    // 1. 检查必要条件
    if (status.value !== 'connected') {
      console.log('⏳ Waiting for connection status... Current:', status.value);
      return;
    }

    if (!provider.value) {
      throw new Error('Provider is null');
    }

    // 2. 验证 provider 是否是有效的 EIP-1193 对象
    if (typeof provider.value.request !== 'function') {
      throw new Error('Invalid provider: missing request method');
    }

    // 3. 测试 provider 是否真正可用（发送测试请求）
    try {
      const chainId = await provider.value.request({ method: 'eth_chainId' });
      console.log('✅ Provider is ready, chainId:', chainId);
    } catch (testError: any) {
      console.warn('⚠️ Provider not ready yet, will retry:', testError.message);
      // 延迟重试（避免过早访问未就绪的 provider）
      setTimeout(initializeProvider, 500);
      return;
    }

    console.log('🔄 Wrapping Web3Auth provider with ethers.js BrowserProvider...');

    // 4. 包装 provider（使用 ethers.js BrowserProvider）
    walletProvider.value = markRaw(getProvider(provider.value));

    // 5. 获取 signer 和地址
    const signer = await getSigner(walletProvider.value as BrowserProvider);
    const signerAddress = await signer.getAddress();

    // 保存到本地状态
    walletSigner.value = signer;
    walletAddress.value = signerAddress;

    console.log('✅ Wallet initialized successfully:', signerAddress);

    // 6. 更新 wallet store
    walletStore.setConnection({
      provider: walletProvider.value,
      signer: signer,
      privateKey: walletPrivateKey.value, // 初始为空，需要手动导出
      walletAddress: signerAddress,
      connectionType: 'web3auth',
    });

    console.log('✅ Wallet store updated');
  } catch (error: any) {
    console.error('❌ Failed to initialize provider:', error);
    initializationError.value = error.message || 'Unknown error';

    // 显示错误给用户
    alert(`Failed to initialize wallet: ${error.message}`);
  }
}

// ============================================================================
// Private Key Export
// ============================================================================

/**
 * 导出私钥（需要用户授权）
 * https://docs.metamask.io/embedded-wallets/dashboard/advanced/key-export
 */
async function requestUserPrivateKey() {
  // Ensure user is authenticated
  if (status.value !== 'connected') {
    throw new Error('User not authenticated');
  }

  if (!provider.value) {
    throw new Error('Web3Auth provider not available');
  }

  if (!walletProvider.value) {
    throw new Error('Wallet provider not initialized');
  }

  // Request private key (requires user consent)
  try {
    console.log('requesting private key', provider.value);
    // https://github.com/orgs/Web3Auth/discussions/322
    // For EVM Chains (Ethereum, Polygon, BNB Chain, etc.): use eth_private_key
    // For Solana: use solanaPrivateKey
    // For other customchains: use private_key
    const privateKey = await provider.value.request({
      method: 'private_key',
    });

    // Handle the private key securely
    console.log('Private key retrieved successfully');
    walletPrivateKey.value = privateKey as string;
    walletStore.setWalletPrivateKey(privateKey as string);
    return privateKey;
  } catch (error) {
    // Handle export rejection or failure
    console.error('Key export failed:', error);
    throw error;
  }
}

// ============================================================================
// Watch Status and Provider Changes
// ============================================================================

/**
 * ✅ 监听 Web3Auth 状态和 Provider 变化
 *
 * 关键点：
 * 1. 只在 status === 'connected' 时初始化
 * 2. 添加延迟确保 provider 完全就绪
 * 3. 避免重复初始化
 */
watch(
  [() => status.value, () => provider.value],
  ([newStatus, newProvider]) => {
    console.log('📡 Web3Auth State Changed:', {
      status: newStatus,
      hasProvider: !!newProvider,
      isInitializing: isInitializing.value,
    });

    // 连接成功
    if (newStatus === 'connected' && newProvider && !walletProvider.value) {
      console.log('🎉 Web3Auth connected! Initializing provider in 200ms...');

      // ✅ 添加短暂延迟，确保 provider 完全就绪
      setTimeout(() => {
        initializeProvider();
      }, 200);
    }

    // 断开连接
    else if (newStatus === 'disconnected') {
      console.log('🔌 Web3Auth disconnected. Cleaning up...');

      // 清理状态
      walletProvider.value = null;
      walletSigner.value = null;
      walletAddress.value = '';
      // walletPrivateKey.value = '';
      initializationError.value = '';
      walletStore.clear();

      console.log('✅ Wallet state cleared');
    }
  },
  { immediate: true }
);

/**
 * ✅ 监听 Wagmi 地址变化（作为备用）
 */
watch(
  () => address.value,
  (newAddress) => {
    if (newAddress && !walletAddress.value) {
      console.log('📬 Wagmi address detected:', newAddress);
      walletAddress.value = newAddress;
    }
  },
  { immediate: true }
);

/**
 * 监听初始化错误
 */
watch(
  () => initError.value,
  (error) => {
    if (error) {
      console.error('❌ Web3Auth initialization error:', error);
      initializationError.value = error.message || 'Initialization failed';
    }
  }
);

async function handleSwitchChain() {
  // console.log(chains.value);
  // const ddcChain = chains.value.find((chain) => chain.id === 44508);
  // if (ddcChain) {
  switchChain({ chainId: '0xaddc' }); //0xADDC
  // }
}
</script>

<template>
  <div class="web3auth-connector">
    <h2>🌐 Web3Auth Wallet Connection</h2>
    <p class="description">
      Connect using social logins (Google, Twitter, etc.) or external wallets
    </p>

    <!-- Connected: Display wallet info -->
    <div class="wallet-info">
      <div class="info-row">
        <span class="label">Status:</span>
        <span class="value">{{ status }}</span>
      </div>
      <div class="info-row">
        <span class="label">Connection Name:</span>
        <span class="value">{{ connectorName }}</span>
      </div>
      <!-- <div v-if="loading">Loading user info...</div>
      <div v-else-if="error">Error: {{ error.message }}</div>
      <div v-else-if="!userInfo">No user info available.</div>
      -->
      <div v-if="userInfo">
        <pre>{{ JSON.stringify(userInfo, null, 2) }}</pre>
        <div>MFA Enabled: {{ isMFAEnabled ? 'Yes' : 'No' }}</div>
        <button @click="getUserInfo">Refresh User Info</button>
      </div>
      <div class="info-row">
        <span class="label">Wallet Address:</span>
        <code class="address">{{ walletAddress }} - address: {{ address }}</code>
      </div>
      <!-- <div>
        <h2>Balance</h2>
        <div>
          <span v-if="data && data.value !== undefined">
            {{ formatUnits(data.value, data.decimals) }} {{ data.symbol }}
          </span>
          <span v-if="isLoading">Loading...</span>
          <span v-if="balanceError">Error: {{ balanceError.message }}</span>
        </div>
      </div> -->
      <!-- Not Connected: Display connection button -->
      <div v-if="!isConnected" class="connect-options">
        <button @click="connect" class="btn btn-primary" :disabled="connectLoading">
          <span v-if="!connectLoading">🌐 Connect with Web3Auth</span>
          <span v-else>⏳ Connecting...</span>
        </button>
        <p class="info-text">Web3Auth supports Google, Twitter, Discord, GitHub and more!</p>
      </div>

      <!-- Export Private Key -->
      <div class="export-section">
        <button @click="requestUserPrivateKey" class="btn btn-warning">
          🔑 Export Private Key
        </button>

        <div v-if="walletPrivateKey" class="exported-key-container">
          <div class="key-display">
            <label>Private Key:</label>
            <code class="private-key">{{ walletPrivateKey }}</code>
          </div>
          <p class="warning">
            ⚠️ Warning: Keep your private key secure! Never share it with anyone!
          </p>
        </div>
      </div>
    </div>

    <!-- Connected: Display disconnect button -->
    <div v-if="isConnected" class="actions">
      <button @click="disconnect()" class="btn btn-danger">⛔ Disconnect</button>
    </div>
    <div class="actions column">
      <button @click="handleSwitchChain" class="btn btn-danger">Switch Chain</button>
      <div v-if="switchChainError" class="error">{{ switchChainError.message }}</div>
      <div class="loading">
        {{ switchChainLoading ? 'Switching...' : 'Switched' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.web3auth-connector {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid #667eea;
}

h2 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  color: #333;
}

.description {
  margin: 0 0 1.5rem 0;
  color: #666;
  font-size: 0.9rem;
}

.status {
  padding: 1rem;
  border-radius: 8px;
  background: #f5f5f5;
  margin-bottom: 1.5rem;
  text-align: center;
  font-weight: 500;
}

.status.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.status.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.wallet-info {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.info-row {
  display: flex;
  align-items: center;
  margin-bottom: 0.75rem;
}

.info-row:last-child {
  margin-bottom: 0;
}

.label {
  font-weight: 600;
  color: #555;
  min-width: 120px;
}

.value {
  flex: 1;
  text-align: center;
  color: #667eea;
  font-weight: 500;
}

.address {
  color: #0066cc;
  display: block;
  padding: 0.5rem;
  background: white;
  border-radius: 6px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
  word-break: break-all;
  flex: 1;
}

.connect-options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.info-text {
  margin: 0;
  color: #666;
  font-size: 0.85rem;
  text-align: center;
}

.actions {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.column {
  flex-direction: column;
}

.btn {
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  width: 100%;
  max-width: 300px;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-warning {
  background: #ffc107;
  color: #000;
  width: 100%;
}

.btn-warning:hover {
  background: #e0a800;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.exported-key-container {
  margin-top: 1rem;
  padding: 1rem;
  background: #fff3cd;
  border-radius: 8px;
  border: 1px solid #ffc107;
}

.key-display {
  margin-bottom: 1rem;
}

.key-display label {
  display: block;
  font-weight: 600;
  color: #555;
  margin-bottom: 0.5rem;
}

.private-key {
  display: block;
  padding: 0.75rem;
  background: white;
  border-radius: 6px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.75rem;
  word-break: break-all;
  color: #c82333;
  border: 1px solid #dc3545;
}

.key-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.warning {
  margin: 0;
  font-size: 0.85rem;
  color: #856404;
}
</style>
