<script setup lang="ts">
/**
 * JsonRpcProvider Mode Demo
 *
 * Minimal demo to verify SDK JsonRpcProvider mode functionality:
 * 1. Initialize Manager with JsonRpcProvider
 * 2. Deploy NFT Contract
 * 3. Mint NFT
 * 4. Query NFT Info
 */

import { ref, toRaw } from 'vue';
import { DDCNFTManager, getKeyHash } from '@ddc-market/sdk';

// ============================================================================
// State - User Inputs (fill these)
// ============================================================================
const privateKey = ref('');
const walletAddress = ref('');

// ============================================================================
// State - Manager & Contract
// ============================================================================
const nftManager = ref<DDCNFTManager | null>(null);
const factoryAddress = ref('');
const nftContractAddress = ref('');
const deployedContracts = ref<string[]>([]); // All deployed contracts
const selectedContract = ref(''); // User selected contract address

// ============================================================================
// State - Operations
// ============================================================================
const nftName = ref('TestNFT');
const nftSymbol = ref('TNFT');
const mintTokenId = ref('1');
const mintKey = ref(''); // Fill: Key for minting
const queryTokenId = ref('1');
const tokenURI = ref('');

const loading = ref(false);
const status = ref('');

// ============================================================================
// Methods
// ============================================================================

async function initializeManager() {
  if (loading.value) return;

  if (!privateKey.value.trim() || !walletAddress.value.trim()) {
    status.value = 'Please fill privateKey and walletAddress';
    return;
  }

  try {
    loading.value = true;
    status.value = 'Initializing...';

    nftManager.value = await DDCNFTManager.init({
      walletAddress: walletAddress.value.trim(),
      provider: { type: 'jsonRpc' },
      signer: { privateKey: privateKey.value.trim() },
      debug: false,
    });

    factoryAddress.value = nftManager.value.getFactoryAddress();
    const contracts = nftManager.value.getAllDeployedAddresses();
    deployedContracts.value = [...contracts];

    // Auto-select first contract if available
    if (contracts.length > 0 && contracts[0]) {
      selectedContract.value = contracts[0];
      nftContractAddress.value = contracts[0];
      nftManager.value.setContractAddress(contracts[0]);
    }

    status.value = 'Initialized successfully';
  } catch (error: any) {
    status.value = `Error: ${error.message}`;
    console.error(error);
  } finally {
    loading.value = false;
  }
}

async function deployFactory() {
  if (!nftManager.value || loading.value) return;

  try {
    loading.value = true;
    status.value = 'Deploying factory...';

    // Use toRaw() to avoid Vue 3 Proxy wrapping issue with ethers objects
    const rawManager = toRaw(nftManager.value);
    const result = await rawManager.deployFactory();
    factoryAddress.value = result.contractAddress;
    status.value = `Factory deployed: ${result.contractAddress}`;
  } catch (error: any) {
    status.value = `Error: ${error.message}`;
    console.error(error);
  } finally {
    loading.value = false;
  }
}

async function deployNFT() {
  if (!nftManager.value || loading.value) return;

  try {
    loading.value = true;
    status.value = 'Deploying NFT contract...';

    // Use toRaw() to avoid Vue 3 Proxy wrapping issue with ethers objects
    const rawManager = toRaw(nftManager.value);
    const result = await rawManager.deployContract(nftName.value, nftSymbol.value);
    nftContractAddress.value = result.contractAddress;
    selectedContract.value = result.contractAddress;
    rawManager.setContractAddress(result.contractAddress);

    // Refresh contracts list to include the new contract
    const contracts = rawManager.getAllDeployedAddresses();
    deployedContracts.value = [...contracts];

    status.value = `NFT deployed: ${result.contractAddress}`;
  } catch (error: any) {
    status.value = `Error: ${error.message}`;
    console.error(error);
  } finally {
    loading.value = false;
  }
}

async function mintNFT() {
  if (!nftManager.value || loading.value || !mintKey.value.trim()) return;

  try {
    loading.value = true;
    status.value = 'Minting NFT...';

    // Use toRaw() to avoid Vue 3 Proxy wrapping issue with ethers objects
    const rawManager = toRaw(nftManager.value);
    const keyHash = getKeyHash(mintKey.value.trim());
    const txHash = await rawManager.mint(BigInt(mintTokenId.value), keyHash);
    status.value = `Minted! Tx: ${txHash}`;
  } catch (error: any) {
    status.value = `Error: ${error.message}`;
    console.error(error);
  } finally {
    loading.value = false;
  }
}

async function loadDeployedContracts() {
  if (!nftManager.value || loading.value) return;

  try {
    loading.value = true;
    status.value = 'Loading contracts...';

    const contracts = nftManager.value.getAllDeployedAddresses();
    deployedContracts.value = [...contracts];
    status.value = `Found ${contracts.length} deployed contract(s)`;
  } catch (error: any) {
    status.value = `Error: ${error.message}`;
    console.error(error);
  } finally {
    loading.value = false;
  }
}

async function selectContract(address: string) {
  if (!nftManager.value || loading.value) return;

  try {
    loading.value = true;
    status.value = `Selecting contract: ${address}`;

    // Use toRaw() to avoid Vue 3 Proxy wrapping issue with ethers objects
    // See: https://github.com/ethers-io/ethers.js/issues/4521
    const rawManager = toRaw(nftManager.value);
    rawManager.setContractAddress(address);
    selectedContract.value = address;
    nftContractAddress.value = address;

    // Verify contract is accessible using SDK methods
    let name = 'Unknown';
    let symbol = 'Unknown';
    try {
      // Use toRaw() to get the raw manager instance to avoid Proxy wrapping
      name = await rawManager.getName();
      symbol = await rawManager.getSymbol();
    } catch (queryError) {
      console.warn('Could not query contract name/symbol:', queryError);
    }

    status.value = `Contract selected! Name: ${name}, Symbol: ${symbol}`;
  } catch (error: any) {
    status.value = `Error: ${error.message}`;
    console.error(error);
  } finally {
    loading.value = false;
  }
}

async function queryNFT() {
  if (!nftManager.value || loading.value) return;

  try {
    loading.value = true;
    status.value = 'Querying...';

    // Use toRaw() to avoid Vue 3 Proxy wrapping issue with ethers objects
    const rawManager = toRaw(nftManager.value);
    const uri = await rawManager.getTokenURI(BigInt(queryTokenId.value));
    tokenURI.value = uri;
    status.value = `Token URI: ${uri}`;
  } catch (error: any) {
    status.value = `Error: ${error.message}`;
    console.error(error);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="jsonrpc-demo">
    <h2>JsonRpcProvider Mode Demo</h2>
    <p class="subtitle">Verify SDK JsonRpcProvider mode functionality</p>

    <!-- Configuration -->
    <div class="section">
      <h3>Configuration</h3>
      <div class="form-group">
        <label>Private Key:</label>
        <input
          v-model="privateKey"
          type="password"
          placeholder="0x..."
          :disabled="loading || !!nftManager"
        />
      </div>
      <div class="form-group">
        <label>Wallet Address:</label>
        <input
          v-model="walletAddress"
          type="text"
          placeholder="0x..."
          :disabled="loading || !!nftManager"
        />
      </div>
      <button
        @click="initializeManager"
        :disabled="loading || !!nftManager"
        class="btn btn-primary"
      >
        {{ nftManager ? '✓ Initialized' : 'Initialize Manager' }}
      </button>
      <div v-if="factoryAddress" class="info">Factory: {{ factoryAddress }}</div>
      <div v-if="nftContractAddress" class="info">NFT Contract: {{ nftContractAddress }}</div>
    </div>

    <!-- Deploy Factory -->
    <div v-if="nftManager && !factoryAddress" class="section">
      <h3>Deploy Factory</h3>
      <button @click="deployFactory" :disabled="loading" class="btn btn-primary">
        Deploy Factory
      </button>
    </div>

    <!-- Deploy NFT -->
    <div v-if="nftManager && factoryAddress" class="section">
      <h3>Deploy NFT Contract</h3>
      <div class="form-group">
        <label>NFT Name:</label>
        <input v-model="nftName" type="text" :disabled="loading || !!nftContractAddress" />
      </div>
      <div class="form-group">
        <label>NFT Symbol:</label>
        <input v-model="nftSymbol" type="text" :disabled="loading || !!nftContractAddress" />
      </div>
      <button
        @click="deployNFT"
        :disabled="loading || !!nftContractAddress"
        class="btn btn-primary"
      >
        {{ nftContractAddress ? '✓ Deployed' : 'Deploy NFT' }}
      </button>
    </div>

    <!-- Deployed Contracts List -->
    <div v-if="nftManager && factoryAddress" class="section">
      <h3>Deployed Contracts</h3>
      <p class="section-desc">Select a contract to use for minting and querying</p>

      <button
        @click="loadDeployedContracts"
        class="btn btn-secondary"
        :disabled="loading"
        style="margin-bottom: 1rem"
      >
        🔄 Refresh Contracts List
      </button>

      <div v-if="deployedContracts.length > 0" class="contracts-list">
        <div
          v-for="(contract, index) in deployedContracts"
          :key="contract"
          class="contract-item"
          :class="{ selected: contract === selectedContract }"
        >
          <div class="contract-info">
            <span class="contract-index">#{{ index + 1 }}</span>
            <code class="contract-address">{{ contract }}</code>
            <span v-if="contract === nftContractAddress" class="badge badge-current">Current</span>
            <span v-if="contract === selectedContract" class="badge badge-selected">Selected</span>
          </div>
          <button
            @click="selectContract(contract)"
            class="btn btn-primary btn-sm"
            :disabled="loading || contract === selectedContract"
          >
            {{ contract === selectedContract ? 'Using' : 'Use This' }}
          </button>
        </div>
      </div>

      <div v-else-if="deployedContracts.length === 0" class="no-contracts">
        No deployed contracts found. Deploy a new contract above or refresh the list.
      </div>
    </div>

    <!-- Mint -->
    <div v-if="nftManager && nftContractAddress && selectedContract" class="section">
      <h3>Mint NFT</h3>
      <div class="form-group">
        <label>Token ID:</label>
        <input v-model="mintTokenId" type="number" :disabled="loading" />
      </div>
      <div class="form-group">
        <label>Mint Key:</label>
        <input v-model="mintKey" type="text" placeholder="Enter key" :disabled="loading" />
      </div>
      <button @click="mintNFT" :disabled="loading || !mintKey.trim()" class="btn btn-primary">
        Mint NFT
      </button>
    </div>

    <!-- Query -->
    <div v-if="nftManager && nftContractAddress && selectedContract" class="section">
      <h3>Query NFT</h3>
      <div class="form-group">
        <label>Token ID:</label>
        <input v-model="queryTokenId" type="number" :disabled="loading" />
      </div>
      <button @click="queryNFT" :disabled="loading" class="btn btn-secondary">
        Query Token URI
      </button>
      <div v-if="tokenURI" class="info">URI: {{ tokenURI }}</div>
    </div>

    <!-- Status -->
    <div class="status">{{ status }}</div>
  </div>
</template>

<style scoped>
.jsonrpc-demo {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

h2 {
  margin-bottom: 0.5rem;
  color: #333;
}

.subtitle {
  color: #666;
  margin-bottom: 2rem;
  font-size: 0.9rem;
}

.section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.section h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #555;
  font-size: 1.1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #555;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  box-sizing: border-box;
}

.form-group input:disabled {
  background: #e9e9e9;
  cursor: not-allowed;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.info {
  margin-top: 1rem;
  padding: 0.75rem;
  background: white;
  border-radius: 6px;
  font-size: 0.85rem;
  word-break: break-all;
  border: 1px solid #28a745;
}

.status {
  margin-top: 2rem;
  padding: 1rem;
  background: #e3f2fd;
  border-radius: 6px;
  text-align: center;
  font-weight: 600;
  color: #1976d2;
}

.section-desc {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.contracts-list {
  margin-top: 1rem;
}

.contract-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  transition: all 0.3s ease;
}

.contract-item:hover {
  border-color: #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.contract-item.selected {
  border-color: #667eea;
  background: #f0f3ff;
}

.contract-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.contract-index {
  font-weight: bold;
  color: #667eea;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.contract-address {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
  color: #333;
  background: #f8f9fa;
  padding: 0.5rem;
  border-radius: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}

.badge-current {
  background: #28a745;
  color: white;
}

.badge-selected {
  background: #667eea;
  color: white;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

.no-contracts {
  margin-top: 1rem;
  padding: 1.5rem;
  background: white;
  border: 2px dashed #ddd;
  border-radius: 8px;
  text-align: center;
  color: #999;
}
</style>
