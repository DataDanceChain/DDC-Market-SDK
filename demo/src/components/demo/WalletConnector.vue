<script setup lang="ts">
/**
 * WalletConnector Component
 *
 * Features:
 * 1. Connect/disconnect MetaMask wallet
 * 2. Display connection status and wallet address
 * 3. Get Signer for other components
 * 4. Support private key import (for testing)
 *
 * Preparation:
 * 1. Prepare your EVM compatible wallet address
 * 2. Prepare your private key
 */

import { ref, computed } from 'vue';
import { useWalletStore } from '../../stores/wallet';
import { getProvider, getSigner, getAddress } from '@ddc-market/sdk';

// ============================================================================
// Store
// =========================================================================
const walletStore = useWalletStore();

// ============================================================================
// State Management
// ============================================================================

const walletAddress = ref<string>('');
const connected = ref(false);
const status = ref<string>('Wallet not connected');
// Input Your Wallet Private Key Here !!!
const networkInfo = ref<{ chainId: number; chainName: string } | null>(null);

// ============================================================================
// Computed
// ============================================================================

const statusClass = computed(() => {
  if (status.value.includes('success') || status.value.includes('Success')) return 'success';
  if (
    status.value.includes('failed') ||
    status.value.includes('Failed') ||
    status.value.includes('error') ||
    status.value.includes('Error')
  )
    return 'error';
  return '';
});

// ============================================================================
// Methods
// ============================================================================

/**
 * Connect wallet via MetaMask
 */
async function connectMetaMask() {
  try {
    status.value = 'Connecting to MetaMask...';

    // Check if MetaMask is installed
    if (!window.ethereum) {
      status.value = '❌ MetaMask not detected! Please install MetaMask extension';
      return;
    }

    // Create Provider
    const provider = getProvider(window.ethereum);
    // Get Signer for SDK
    const signer = await getSigner(provider);
    // Get wallet address
    const address = await getAddress(signer);
    
    // Request account access
    const accounts = await (provider as any).send('eth_requestAccounts', []);
    if (accounts.length === 0) {
      status.value = '❌ No accounts found';
      return;
    }

    // Get network information
    try {
      const network = await provider.getNetwork();
      networkInfo.value = {
        chainId: Number(network.chainId),
        chainName: network.name,
      };
    } catch (error) {
      console.warn('Failed to get network info:', error);
    }
  
    // Update state
    walletAddress.value = address;
    connected.value = true;
    status.value = '✅ MetaMask connected successfully';

    // Update global wallet store
    walletStore.setConnection({
      provider,
      signer,
      walletAddress: address,
      privateKey: privateKey.value,
      connectionType: 'metamask',
    });

    console.log('✅ Wallet connected:', address);
    console.log('✅ Network:', networkInfo.value);
  } catch (error: any) {
    status.value = `❌ Connection failed: ${error.message}`;
    console.error('Failed to connect MetaMask:', error);
  }
}

/**
 * Disconnect wallet
 */
function disconnect() {
  walletAddress.value = '';
  connected.value = false;
  networkInfo.value = null;
  status.value = 'Disconnected';

  // Clear global store
  walletStore.clear();

  console.log('👋 Wallet disconnected');
}
</script>

<template>
  <div class="wallet-connector">
    <h2>💼 Wallet Connection</h2>

    <!-- Connection Status -->
    <div class="status" :class="statusClass">
      {{ status }}
    </div>

    <!-- Connected: Display wallet info -->
    <div v-if="connected" class="wallet-info">
      <div class="info-row">
        <span class="label">Wallet Address:</span>
        <code class="address">{{ walletAddress }}</code>
      </div>
      <div class="info-row">
        <span class="label">Private Key:</span>
        <code class="address">{{ privateKey }}</code>
      </div>
      <div v-if="networkInfo" class="info-row">
        <span class="label">Network:</span>
        <div class="network-info">
          <span class="network-name">{{ networkInfo.chainName || 'Unknown' }}</span>
          <span class="network-id">(Chain ID: {{ networkInfo.chainId }})</span>
        </div>
      </div>
    </div>

    <!-- Not Connected: Display connection buttons -->
    <div v-else class="connect-options">
      <!-- MetaMask Connection -->
      <button @click="connectMetaMask" class="btn btn-primary">🦊 Connect MetaMask</button>
    </div>

    <!-- Connected: Display disconnect button -->
    <div v-if="connected" class="actions">
      <button @click="disconnect" class="btn btn-danger">⛔ Disconnect</button>
    </div>
  </div>
</template>

<style scoped>
.wallet-connector {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

h2 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #333;
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
  min-width: 100px;
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

.network-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  background: white;
  border-radius: 6px;
  flex: 1;
}

.network-name {
  font-weight: 600;
  color: #667eea;
  font-size: 0.95rem;
}

.network-id {
  font-size: 0.85rem;
  color: #666;
}

.connect-options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.private-key-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.private-key-input {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: #fff3cd;
  border-radius: 8px;
  border: 1px solid #ffc107;
}

.input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: 'Monaco', 'Courier New', monospace;
}

.input:focus {
  outline: none;
  border-color: #667eea;
}

.warning {
  margin: 0;
  font-size: 0.85rem;
  color: #856404;
}

.actions {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
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
}

.btn-primary:hover {
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

.btn-link {
  background: transparent;
  color: #667eea;
  text-decoration: underline;
  padding: 0.5rem;
}

.btn-link:hover {
  color: #764ba2;
}
</style>
