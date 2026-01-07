<script setup lang="ts">
/**
 * DDCNFTDemo Component
 *
 * Demonstrates complete DDCNFT SDK workflow:
 * 1. Deploy DDCNFTFactory contract
 * 2. Deploy DDCNFT contract via factory
 * 3. Mint NFT
 * 4. Transfer NFT
 * 5. Destroy NFT
 * 6. Query NFT information
 *
 * Usage:
 * - Must connect wallet first
 * - Execute steps in order
 * - Each step has detailed log output
 */

import { ref, computed } from 'vue';
import { DDCNFTManager, getKeyHash } from '@ddcmarket/sdk';
import { useWalletStore } from '../../stores/wallet';

// ============================================================================
// Store
// ============================================================================
const walletStore = useWalletStore();

// ============================================================================
// State Management
// ============================================================================
// Manager instance
const nftManager = ref<DDCNFTManager | null>(null);

// Contract addresses
const factoryAddress = ref<string>('');
const nftContractAddress = ref<string>('');
const deployedContracts = ref<string[]>([]); // 所有已部署的合约列表
const selectedContract = ref<string>(''); // 用户选择的合约地址

// Test data
const nftName = ref('TestNFT');
const nftSymbol = ref('TNFT');
const mintTokenId = ref('1');
const mintKeyHash = ref(''); // Test keyHash
const transferToHash = ref(''); // Transfer target hash (bytes32)
const transferTokenId = ref('1'); // Token ID for transfer
const transferKey = ref(''); // Transfer key for transfer operation
// Input Your Wallet Private Key Here !!!
// Input Your Transfer Target Private Key of Wallet you want to transfer to Here !!!
const privateKey = ref(walletStore.walletPrivateKey);
const destroyKey = ref(privateKey.value); // Destroy key
const queryTokenId = ref('1'); // Token ID for querying URI
const tokenURI = ref(''); // Token URI result
const baseURI = ref(''); // Base URI for NFT metadata
const newOwnerAddress = ref(''); // New owner address for transferOwnership
const destroyTokenId = ref('1'); // Token ID to destroy
const setTokenId = ref('1'); // Token ID for setting URI
const setTokenURIValue = ref(''); // URI value to set for token
const clearTokenId = ref('1'); // Token ID for clearing URI
const ddcNftResult = ref<{
  contractAddress: string;
  transactionHash: string;
  blockNumber?: number;
} | null>(null);

// State management
const loading = ref(false);
const currentStep = ref(0);
const logs = ref<string[]>([]);

// ============================================================================
// Computed
// ============================================================================

const isConnected = computed(() => walletStore.walletAddress !== '');
const canInitialize = computed(() => isConnected.value && currentStep.value === 0);
// const canDeployFactory = computed(() => currentStep.value === 1)
const canDeployNFT = computed(() => factoryAddress.value !== '');
const canMint = computed(() => nftContractAddress.value !== '');
const canTransfer = computed(
  () => currentStep.value >= 3 && transferToHash.value !== '' && transferTokenId.value !== ''
);

// ============================================================================
// Methods
// ============================================================================

/**
 * Add log entry
 */
function addLog(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  logs.value.unshift(`[${timestamp}] ${prefix} ${message}`);
}

/**
 * Step 1: Initialize DDCNFTManager
 */
async function initializeManager() {
  if (!walletStore.provider || !walletStore.walletAddress) {
    addLog('Please connect wallet first', 'error');
    return;
  }

  try {
    loading.value = true;
    addLog('Initializing DDCNFTManager...');

    // Initialize Manager
    // Note: walletStore.signer is already wrapped with markRaw in store, so no need for toRaw here
    nftManager.value = await DDCNFTManager.init({
      walletAddress: walletStore.walletAddress,
      provider: walletStore.provider,
      debug: true,
    });

    factoryAddress.value = nftManager.value.getFactoryAddress();

    // 获取所有已部署的合约
    const contracts = nftManager.value.getAllDeployedAddresses();
    deployedContracts.value = [...contracts];
    addLog(`Found ${contracts.length} deployed contracts`, 'info');

    // 获取默认的 metadata URL
    try {
      const defaultMetadataUrl = nftManager.value.getDefaultMetadataURL();
      if (defaultMetadataUrl) {
        baseURI.value = defaultMetadataUrl;
        addLog(`Default Base URI loaded: ${defaultMetadataUrl}`, 'info');
      }
    } catch (error) {
      // 如果没有默认 URL，使用预设值
      addLog('No default metadata URL found, using default value', 'info');
    }

    addLog('DDCNFTManager initialized successfully', 'success');

    if (factoryAddress.value) {
      currentStep.value = 2;
    } else {
      currentStep.value = 1;
    }
  } catch (error: any) {
    addLog(`Initialization failed: ${error.message}`, 'error');
    console.error('Initialize error:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Step 2: Deploy DDCNFTFactory contract
 */
async function deployFactory() {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }
  try {
    loading.value = true;
    addLog('Deploying DDCNFTFactory contract...');
    addLog('This may take a few seconds, waiting for transaction confirmation...');

    // Deploy factory contract
    const result = await nftManager.value.deployDDCFactory();

    factoryAddress.value = result.contractAddress;
    addLog(`Factory contract deployed successfully!`, 'success');
    addLog(`Factory Address: ${result.contractAddress}`);
    addLog(`Transaction Hash: ${result.transactionHash}`);
    addLog(`Block Number: ${result.blockNumber}`);

    currentStep.value = 2;
  } catch (error: any) {
    addLog(`Factory deployment failed: ${error.message}`, 'error');
    console.error('Deploy factory error:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Step 3: Deploy DDCNFT contract via factory
 */
async function deployNFTContract() {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }

  if (!nftName.value || !nftSymbol.value) {
    addLog('Please enter NFT name and symbol', 'error');
    return;
  }

  try {
    loading.value = true;
    addLog(`Deploying DDCNFT contract: ${nftName.value} (${nftSymbol.value})...`);

    // Deploy NFT contract via factory
    const result = await nftManager.value.deployDDCNFT(nftName.value, nftSymbol.value);

    nftContractAddress.value = result.contractAddress;
    ddcNftResult.value = result;
    addLog(`DDCNFT contract deployed successfully!`, 'success');
    addLog(`Contract Address: ${result.contractAddress}`);
    addLog(`Transaction Hash: ${result.transactionHash}`);
    addLog(`Block Number: ${result.blockNumber}`);

    currentStep.value = 3;
  } catch (error: any) {
    addLog(`NFT contract deployment failed: ${error.message}`, 'error');
    console.error('Deploy NFT error:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Step 4: Mint NFT
 */
async function mintNFT() {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }

  if (!mintTokenId.value) {
    addLog('Please enter Token ID', 'error');
    return;
  }

  try {
    loading.value = true;
    addLog(`Minting NFT #${mintTokenId.value}...`);

    const tokenId = BigInt(mintTokenId.value);
    mintKeyHash.value = await getKeyHash(walletStore.privateKey);
    const txHash = await nftManager.value.mint(tokenId, mintKeyHash.value);

    addLog(`NFT minted successfully!`, 'success');
    addLog(`Token ID: ${mintTokenId.value}`);
    addLog(`Transaction Hash: ${txHash}`);

    currentStep.value = 4;
  } catch (error: any) {
    addLog(`Mint failed: ${error.message}`, 'error');
    console.error('Mint error:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Generate transfer target hash
 */
async function generateTransferHash() {
  try {
    loading.value = true;
    addLog('Generating target hash...');
    const hash = await getKeyHash(transferKey.value);
    transferToHash.value = hash;
    addLog(`Target hash generated successfully!`, 'success');
    addLog(`Hash: ${hash}`);
  } catch (error: any) {
    addLog(`Failed to generate hash: ${error.message}`, 'error');
    console.error('Generate hash error:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Step 5: Transfer NFT
 */
async function transferNFT() {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }

  if (!transferTokenId.value) {
    addLog('Please enter Token ID', 'error');
    return;
  }

  if (!transferToHash.value) {
    addLog('Please generate target hash first', 'error');
    return;
  }

  if (!transferKey.value) {
    addLog('Please enter transfer key', 'error');
    return;
  }

  try {
    loading.value = true;
    addLog(`Transferring NFT #${transferTokenId.value}...`);

    const tokenId = BigInt(transferTokenId.value);
    const txHash = await nftManager.value.transfer(transferToHash.value, tokenId, privateKey.value);

    addLog(`NFT transferred successfully!`, 'success');
    addLog(`Target Hash: ${transferToHash.value}`);
    addLog(`Transaction Hash: ${txHash}`);

    currentStep.value = 5;
  } catch (error: any) {
    addLog(`Transfer failed: ${error.message}`, 'error');
    console.error('Transfer error:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Load all deployed contracts
 */
async function loadDeployedContracts() {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }

  try {
    addLog('Loading deployed contracts...');
    const contracts = nftManager.value.getAllDeployedAddresses();
    deployedContracts.value = [...contracts];
    addLog(`Found ${contracts.length} deployed contract(s)`, 'success');

    if (contracts.length > 0) {
      addLog('You can select a contract to interact with', 'info');
    }
  } catch (error: any) {
    addLog(`Failed to load contracts: ${error.message}`, 'error');
    console.error('Load contracts error:', error);
  }
}

/**
 * Select and use a deployed contract
 */
async function selectContract(address: string) {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }

  try {
    loading.value = true;
    addLog(`Selecting contract: ${address}`);

    // 使用 setDDCNFTAddress 方法设置当前合约地址
    nftManager.value.setDDCNFTAddress(address);

    // 验证合约是否可访问并获取合约信息
    const contract = await nftManager.value.getDDCNFTContract();

    let name = 'Unknown';
    let symbol = 'Unknown';
    try {
      if (contract.name) {
        name = await contract.name();
      }
      if (contract.symbol) {
        symbol = await contract.symbol();
      }
    } catch (queryError) {
      console.warn('Could not query contract name/symbol:', queryError);
    }

    // 更新 UI 状态
    nftContractAddress.value = address;
    selectedContract.value = address;

    addLog(`Contract selected successfully!`, 'success');
    addLog(`Name: ${name}, Symbol: ${symbol}`);
    addLog(`Address: ${address}`);

    // 如果当前步骤还在部署阶段，跳到可以操作的阶段
    if (currentStep.value < 3) {
      currentStep.value = 3;
    }
  } catch (error: any) {
    addLog(`Failed to select contract: ${error.message}`, 'error');
    console.error('Select contract error:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Query NFT name
 */
async function queryName() {
  if (!nftManager.value) return;

  try {
    addLog('Querying NFT name...');
    const name = await nftManager.value.getName();
    walletStore.setChainName(name);
    addLog(`NFT Name: ${name}`, 'success');
  } catch (error: any) {
    addLog(`Query failed: ${error.message}`, 'error');
  }
}

/**
 * Query NFT symbol
 */
async function querySymbol() {
  if (!nftManager.value) return;

  try {
    addLog('Querying NFT symbol...');
    const symbol = await nftManager.value.getSymbol();
    addLog(`NFT Symbol: ${symbol}`, 'success');
  } catch (error: any) {
    addLog(`Query failed: ${error.message}`, 'error');
  }
}

/**
 * Load Default Base URI
 */
function loadDefaultBaseURI() {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }

  try {
    const defaultMetadataUrl = nftManager.value.getDefaultMetadataURL();
    if (defaultMetadataUrl) {
      baseURI.value = defaultMetadataUrl;
      addLog(`Default Base URI loaded: ${defaultMetadataUrl}`, 'success');
    }
  } catch (error: any) {
    addLog(`Failed to load default Base URI: ${error.message}`, 'error');
    console.error('Load default Base URI error:', error);
  }
}

/**
 * Set Base URI
 */
async function setNFTBaseURI() {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }

  if (!baseURI.value || !baseURI.value.trim()) {
    addLog('Please enter Base URI', 'error');
    return;
  }

  try {
    loading.value = true;
    addLog(`Setting Base URI: ${baseURI.value}...`);
    await nftManager.value.setBaseURI(baseURI.value);
    addLog('Base URI set successfully!', 'success');
    addLog(`Base URI: ${baseURI.value}`);
  } catch (error: any) {
    addLog(`Set Base URI failed: ${error.message}`, 'error');
    console.error('Set Base URI error:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Query Token URI
 */
async function queryTokenURI() {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }

  if (!queryTokenId.value) {
    addLog('Please enter Token ID', 'error');
    return;
  }

  try {
    loading.value = true;
    addLog(`Querying Token URI for #${queryTokenId.value}...`);
    const tokenId = BigInt(queryTokenId.value);
    const uri = await nftManager.value.getTokenURI(tokenId);
    tokenURI.value = uri;
    addLog(`Token URI: ${uri}`, 'success');
  } catch (error: any) {
    addLog(`Query failed: ${error.message}`, 'error');
    console.error('Query token URI error:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Set Token URI
 */
async function setTokenURI() {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }

  if (!setTokenId.value) {
    addLog('Please enter Token ID', 'error');
    return;
  }

  if (!setTokenURIValue.value || !setTokenURIValue.value.trim()) {
    addLog('Please enter Token URI', 'error');
    return;
  }

  try {
    loading.value = true;
    addLog(`Setting Token URI for #${setTokenId.value}...`);
    const tokenId = BigInt(setTokenId.value);
    const txHash = await nftManager.value.setTokenURI(tokenId, setTokenURIValue.value);
    addLog('Token URI set successfully!', 'success');
    addLog(`Token ID: ${setTokenId.value}`);
    addLog(`URI: ${setTokenURIValue.value}`);
    addLog(`Transaction Hash: ${txHash}`);
  } catch (error: any) {
    addLog(`Set Token URI failed: ${error.message}`, 'error');
    console.error('Set token URI error:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Clear Token URI
 */
async function clearTokenURI() {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }

  if (!clearTokenId.value) {
    addLog('Please enter Token ID', 'error');
    return;
  }

  try {
    loading.value = true;
    addLog(`Clearing Token URI for #${clearTokenId.value}...`);
    const tokenId = BigInt(clearTokenId.value);
    const txHash = await nftManager.value.clearTokenURI(tokenId);
    addLog('Token URI cleared successfully!', 'success');
    addLog(`Token ID: ${clearTokenId.value}`);
    addLog(`Transaction Hash: ${txHash}`);
    addLog('Token will now use baseURI + tokenId', 'info');
  } catch (error: any) {
    addLog(`Clear Token URI failed: ${error.message}`, 'error');
    console.error('Clear token URI error:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Pause NFT Contract
 */
async function pauseContract() {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }

  try {
    loading.value = true;
    addLog('Pausing NFT contract...');
    const txHash = await nftManager.value.pause();
    addLog('Contract paused successfully!', 'success');
    addLog(`Transaction Hash: ${txHash}`);
  } catch (error: any) {
    addLog(`Pause failed: ${error.message}`, 'error');
    console.error('Pause error:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Unpause NFT Contract
 */
async function unpauseContract() {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }

  try {
    loading.value = true;
    addLog('Unpausing NFT contract...');
    const txHash = await nftManager.value.unpause();
    addLog('Contract unpaused successfully!', 'success');
    addLog(`Transaction Hash: ${txHash}`);
  } catch (error: any) {
    addLog(`Unpause failed: ${error.message}`, 'error');
    console.error('Unpause error:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Transfer Contract Ownership
 */
async function transferContractOwnership() {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }

  if (!newOwnerAddress.value || !newOwnerAddress.value.trim()) {
    addLog('Please enter new owner address', 'error');
    return;
  }

  try {
    loading.value = true;
    addLog(`Transferring contract ownership to ${newOwnerAddress.value}...`);
    const txHash = await nftManager.value.transferOwnership(newOwnerAddress.value);
    addLog('Contract ownership transferred successfully!', 'success');
    addLog(`New Owner: ${newOwnerAddress.value}`);
    addLog(`Transaction Hash: ${txHash}`);
  } catch (error: any) {
    addLog(`Transfer ownership failed: ${error.message}`, 'error');
    console.error('Transfer ownership error:', error);
  } finally {
    loading.value = false;
  }
}

/**
 * Destroy NFT
 */
async function destroyNFT() {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }

  if (!destroyTokenId.value) {
    addLog('Please enter Token ID', 'error');
    return;
  }

  if (!destroyKey.value || !destroyKey.value.trim()) {
    addLog('Please enter destroy key', 'error');
    return;
  }

  try {
    loading.value = true;
    addLog(`Destroying NFT #${destroyTokenId.value}...`);

    const tokenId = BigInt(destroyTokenId.value);
    // const keyHash = await getKeyHash(destroyKey.value)
    const txHash = await nftManager.value.destroy(tokenId, destroyKey.value);

    addLog('NFT destroyed successfully!', 'success');
    addLog(`Token ID: ${destroyTokenId.value}`);
    addLog(`Transaction Hash: ${txHash}`);
  } catch (error: any) {
    addLog(`Destroy failed: ${error.message}`, 'error');
    console.error('Destroy error:', error);
  } finally {
    loading.value = false;
  }
}

const testfile = ref<File | null>(null);
const testSignMessage = async () => {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }
  const result = await nftManager.value.uploadMetadataFile(testfile.value as File);
  console.log('result is:', result);
  return result;
};

const testUpdateCustomMetadata = async () => {
  if (!nftManager.value) {
    addLog('Please initialize Manager first', 'error');
    return;
  }
  const result = await testSignMessage();
  const { fileUrl, fileName } = result as { fileUrl: string; fileName: string };
  const res = await nftManager.value.updateCustomMetadata(
    {
      name: 'testcy2TNFT_Metadata',
      description: 'testcy2TNFT_Metadata_Description',
      image: fileUrl,
    },
    {
      contract: '0x1f7a9d34768e052b57783dc2ac2e7ff5125080bd',
      test: 'testcy2TNFT',
      fileName: fileName,
    },
    6
  );
  console.log('testUpdateCustomMetadata  result is:', res);
};

const handleFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    testfile.value = file;
  }
};

/**
 * Reset all state
 */
function reset() {
  nftManager.value = null;
  factoryAddress.value = '';
  nftContractAddress.value = '';
  deployedContracts.value = [];
  selectedContract.value = '';
  transferToHash.value = '';
  tokenURI.value = '';
  newOwnerAddress.value = '';
  setTokenId.value = '1';
  setTokenURIValue.value = '';
  clearTokenId.value = '1';
  currentStep.value = 0;
  logs.value = [];
  addLog('All state reset');
}
</script>

<template>
  <div class="ddcnft-demo">
    <h2>🎨 DDCNFT Workflow Demo</h2>

    <!-- Connection Warning -->
    <div v-if="!isConnected" class="warning-box">
      ⚠️ Please connect wallet first to use DDCNFT features
    </div>

    <div v-else class="demo-container">
      <!-- Steps Indicator -->
      <div class="steps-indicator">
        <div class="step" :class="{ active: currentStep >= 0, completed: currentStep > 0 }">
          <div class="step-number">1</div>
          <div class="step-label">Initialize</div>
        </div>
        <div class="step-line" :class="{ active: currentStep > 0 }"></div>
        <div class="step" :class="{ active: currentStep >= 1, completed: currentStep > 1 }">
          <div class="step-number">2</div>
          <div class="step-label">Deploy Factory</div>
        </div>
        <div class="step-line" :class="{ active: currentStep > 1 }"></div>
        <div class="step" :class="{ active: currentStep >= 2, completed: currentStep > 2 }">
          <div class="step-number">3</div>
          <div class="step-label">Deploy NFT</div>
        </div>
        <div class="step-line" :class="{ active: currentStep > 2 }"></div>
        <div class="step" :class="{ active: currentStep >= 3, completed: currentStep > 3 }">
          <div class="step-number">4</div>
          <div class="step-label">Mint</div>
        </div>
        <div class="step-line" :class="{ active: currentStep > 3 }"></div>
        <div class="step" :class="{ active: currentStep >= 4, completed: currentStep > 4 }">
          <div class="step-number">5</div>
          <div class="step-label">Transfer</div>
        </div>
      </div>

      <!-- Operations Panel -->
      <div class="operations-panel">
        <!-- Step 1: Initialize -->
        <div class="operation-section">
          <h3>Step 1: Initialize DDCNFTManager</h3>
          <p class="desc">Initialize SDK manager instance</p>
          <button
            @click="initializeManager"
            :disabled="!canInitialize || loading"
            class="btn btn-primary"
          >
            {{ loading && currentStep === 0 ? 'Initializing...' : 'Initialize Manager' }}
          </button>
        </div>

        <button @click="testUpdateCustomMetadata" :disabled="loading" class="btn btn-primary">
          test sign message
        </button>
        <input type="file" @change="handleFileChange" />
        <h2>testfile name: {{ testfile?.name }}</h2>

        <!-- Step 2: Deploy Factory -->
        <div v-if="currentStep >= 1" class="operation-section">
          <h3>Step 2: Deploy DDCNFTFactory</h3>
          <p class="desc">Deploy factory contract for subsequent NFT contract deployments</p>
          <button @click="deployFactory" :disabled="loading" class="btn btn-primary">
            {{ loading && currentStep === 1 ? 'Deploying...' : 'Deploy Factory Contract' }}
          </button>
          <div v-if="factoryAddress" class="result-box">
            <strong>Factory Address:</strong>
            <code>{{ factoryAddress }}</code>
          </div>
        </div>

        <!-- Step 3: Deploy NFT -->
        <div v-if="currentStep >= 2" class="operation-section">
          <h3>Step 3: Deploy DDCNFT Contract</h3>
          <p class="desc">Deploy NFT contract via factory</p>
          <div class="form-group">
            <label>NFT Name:</label>
            <input v-model="nftName" type="text" placeholder="TestNFT" class="input" />
          </div>
          <div class="form-group">
            <label>NFT Symbol:</label>
            <input v-model="nftSymbol" type="text" placeholder="TNFT" class="input" />
          </div>
          <button
            @click="deployNFTContract"
            :disabled="!canDeployNFT || loading"
            class="btn btn-primary"
          >
            {{ loading && currentStep === 2 ? 'Deploying...' : 'Deploy NFT Contract' }}
          </button>
          <div v-if="nftContractAddress" class="result-box">
            <div>
              <strong>NFT Contract Address:</strong>
              <code>{{ nftContractAddress }}</code>
            </div>
            <div>
              <strong>Transaction Hash:</strong>
              <code>{{ ddcNftResult?.transactionHash || '' }}</code>
            </div>
            <div>
              <strong>Block Number:</strong>
              <code>{{ ddcNftResult?.blockNumber || '' }}</code>
            </div>
          </div>
        </div>

        <!-- Set Base URI (Optional) -->
        <div v-if="currentStep >= 3" class="operation-section">
          <h3>🔗 Set Base URI (Optional)</h3>
          <p class="desc">
            Set the base URI for NFT metadata. This should be done before minting tokens.
          </p>
          <div class="form-group">
            <label>Base URI:</label>
            <div class="input-with-button">
              <input
                v-model="baseURI"
                type="text"
                placeholder="https://api.example.com/metadata/"
                class="input"
              />
              <button
                @click="loadDefaultBaseURI"
                class="btn btn-icon"
                title="Load Default Base URI"
                :disabled="loading"
              >
                🔄
              </button>
            </div>
            <small>The base URI will be used to construct token URIs (baseURI + tokenId)</small>
          </div>
          <button @click="setNFTBaseURI" :disabled="loading" class="btn btn-secondary">
            {{ loading ? 'Setting...' : 'Set Base URI' }}
          </button>
        </div>

        <!-- Step 4: Mint -->
        <div v-if="currentStep >= 3" class="operation-section">
          <h3>Step 4: Mint NFT</h3>
          <p class="desc">Mint a new NFT</p>
          <div class="form-group">
            <label>Token ID:</label>
            <input v-model="mintTokenId" type="number" placeholder="1" class="input" />
          </div>
          <div class="form-group">
            <label>Key Hash:</label>
            <input v-model="mintKeyHash" type="text" placeholder="0x..." class="input" disabled />
            <small>Key hash for verification (test fixed value)</small>
          </div>
          <button @click="mintNFT" :disabled="!canMint || loading" class="btn btn-primary">
            {{ loading && currentStep === 3 ? 'Minting...' : 'Mint NFT' }}
          </button>
        </div>

        <!-- Step 5: Transfer -->
        <div v-if="currentStep >= 3" class="operation-section">
          <h3>🔄 Transfer NFT</h3>
          <p class="desc">Transfer NFT to another user (requires target user's private key hash)</p>

          <div class="form-group">
            <label>Token ID to Transfer:</label>
            <input v-model="transferTokenId" type="number" placeholder="1" class="input" />
          </div>

          <button
            @click="generateTransferHash"
            :disabled="loading"
            class="btn btn-secondary btn-sm"
          >
            {{ loading ? 'Generating...' : '🔑 Generate Target Hash' }}
          </button>

          <div v-if="transferToHash" class="result-box">
            <strong>Target Hash (toHash):</strong>
            <code>{{ transferToHash }}</code>
          </div>

          <div class="form-group">
            <label>Transfer Key:</label>
            <input
              v-model="transferKey"
              type="text"
              placeholder="Enter transfer key"
              class="input"
            />
            <small>The key used for transfer verification</small>
          </div>

          <button @click="transferNFT" :disabled="!canTransfer || loading" class="btn btn-primary">
            {{ loading ? 'Transferring...' : '🚀 Transfer NFT' }}
          </button>
        </div>

        <!-- Deployed Contracts List -->
        <div v-if="currentStep >= 2" class="operation-section">
          <h3>📜 Deployed Contracts</h3>
          <p class="desc">View and select from previously deployed contracts</p>

          <button
            @click="loadDeployedContracts"
            class="btn btn-secondary btn-sm"
            :disabled="loading"
          >
            🔄 Refresh Contracts List
          </button>

          <div v-if="deployedContracts.length > 0" class="contracts-list">
            <h4>Available Contracts ({{ deployedContracts.length }})</h4>
            <div class="contract-items">
              <div
                v-for="(contract, index) in deployedContracts"
                :key="contract"
                class="contract-item"
                :class="{ selected: contract === selectedContract }"
              >
                <div class="contract-info">
                  <span class="contract-index">#{{ index + 1 }}</span>
                  <code class="contract-address">{{ contract }}</code>
                  <span v-if="contract === nftContractAddress" class="badge badge-current">
                    Current
                  </span>
                  <span v-if="contract === selectedContract" class="badge badge-selected">
                    Selected
                  </span>
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
          </div>

          <div v-else-if="deployedContracts.length === 0" class="no-contracts">
            No deployed contracts found. Deploy a new contract above or refresh the list.
          </div>
        </div>

        <!-- Query Functions -->
        <div v-if="currentStep >= 3" class="operation-section">
          <h3>🔍 Query Functions</h3>
          <div class="query-section">
            <div class="query-group">
              <h4>Contract Information</h4>
              <div class="query-buttons">
                <button @click="queryName" class="btn btn-secondary btn-sm" :disabled="loading">
                  Query Name
                </button>
                <button @click="querySymbol" class="btn btn-secondary btn-sm" :disabled="loading">
                  Query Symbol
                </button>
              </div>
            </div>

            <div class="query-group">
              <h4>Token URI</h4>
              <div class="form-group">
                <label>Token ID:</label>
                <input
                  v-model="queryTokenId"
                  type="number"
                  placeholder="1"
                  class="input input-sm"
                />
              </div>
              <button @click="queryTokenURI" class="btn btn-secondary btn-sm" :disabled="loading">
                Get Token URI
              </button>
              <div v-if="tokenURI" class="result-box">
                <strong>Token URI:</strong>
                <code>{{ tokenURI }}</code>
              </div>
            </div>

            <div class="query-group">
              <h4>Set Token URI</h4>
              <p class="desc">
                Set an individual full URI for a specific token. Use only when the token needs
                completely different metadata from others.
              </p>
              <div class="form-group">
                <label>Token ID:</label>
                <input v-model="setTokenId" type="number" placeholder="1" class="input input-sm" />
              </div>
              <div class="form-group">
                <label>Token URI:</label>
                <input
                  v-model="setTokenURIValue"
                  type="text"
                  placeholder="https://api.example.com/metadata/token/1"
                  class="input input-sm"
                />
                <small>Full URI for this specific token</small>
              </div>
              <button @click="setTokenURI" class="btn btn-secondary btn-sm" :disabled="loading">
                {{ loading ? 'Setting...' : 'Set Token URI' }}
              </button>
            </div>

            <div class="query-group">
              <h4>Clear Token URI</h4>
              <p class="desc">
                Clear the individual URI for a specific token. After clearing, the token will fall
                back to using baseURI + tokenId.
              </p>
              <div class="form-group">
                <label>Token ID:</label>
                <input
                  v-model="clearTokenId"
                  type="number"
                  placeholder="1"
                  class="input input-sm"
                />
              </div>
              <button @click="clearTokenURI" class="btn btn-secondary btn-sm" :disabled="loading">
                {{ loading ? 'Clearing...' : 'Clear Token URI' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Contract Control Functions -->
        <div v-if="currentStep >= 3" class="operation-section">
          <h3>⚙️ Contract Control</h3>
          <p class="desc">Pause or unpause the contract (owner only)</p>
          <div class="control-buttons">
            <button @click="pauseContract" class="btn btn-warning btn-sm" :disabled="loading">
              ⏸️ Pause Contract
            </button>
            <button @click="unpauseContract" class="btn btn-success btn-sm" :disabled="loading">
              ▶️ Unpause Contract
            </button>
          </div>
        </div>

        <!-- Transfer Contract Ownership -->
        <div v-if="currentStep >= 3" class="operation-section">
          <h3>👑 Transfer Contract Ownership</h3>
          <p class="desc">
            Transfer contract ownership to another address (owner only, irreversible!)
          </p>
          <div class="form-group">
            <label>New Owner Address:</label>
            <input v-model="newOwnerAddress" type="text" placeholder="0x..." class="input" />
            <small
              >⚠️ Warning: This action is irreversible. The new owner will have full control of the
              contract.</small
            >
          </div>
          <button
            @click="transferContractOwnership"
            :disabled="loading || !newOwnerAddress"
            class="btn btn-warning"
          >
            {{ loading ? 'Transferring...' : '👑 Transfer Ownership' }}
          </button>
        </div>

        <!-- Destroy NFT -->
        <div v-if="currentStep >= 3" class="operation-section">
          <h3>🔥 Destroy NFT</h3>
          <p class="desc">Permanently destroy (burn) an NFT token</p>
          <div class="form-group">
            <label>Token ID to Destroy:</label>
            <input v-model="destroyTokenId" type="number" placeholder="1" class="input" />
          </div>
          <div class="form-group">
            <label>Destroy Key:</label>
            <input v-model="destroyKey" type="text" placeholder="Enter destroy key" class="input" />
            <small
              >The key required to destroy this NFT (must match the key used during minting)</small
            >
          </div>
          <button
            @click="destroyNFT"
            :disabled="loading || !destroyTokenId || !destroyKey"
            class="btn btn-danger"
          >
            {{ loading ? 'Destroying...' : '🔥 Destroy NFT' }}
          </button>
        </div>

        <!-- Reset Button -->
        <div v-if="currentStep > 0" class="operation-section">
          <button @click="reset" class="btn btn-danger">🔄 Reset All State</button>
        </div>
      </div>

      <!-- Logs Panel -->
      <div class="logs-panel">
        <h3>📋 Operation Logs</h3>
        <div class="logs-container">
          <div v-if="logs.length === 0" class="no-logs">No logs yet</div>
          <div v-else class="log-list">
            <div v-for="(log, index) in logs" :key="index" class="log-item">
              {{ log }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ddcnft-demo {
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

h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #555;
  font-size: 1.1rem;
}

.warning-box {
  padding: 1rem;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  color: #856404;
  text-align: center;
}

.demo-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* 步骤指示器 */
.steps-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: #666;
  transition: all 0.3s ease;
}

.step.active .step-number {
  background: #667eea;
  color: white;
}

.step.completed .step-number {
  background: #28a745;
  color: white;
}

.step-label {
  font-size: 0.85rem;
  color: #666;
}

.step.active .step-label {
  color: #667eea;
  font-weight: 600;
}

.step-line {
  width: 50px;
  height: 2px;
  background: #ddd;
  transition: all 0.3s ease;
}

.step-line.active {
  background: #667eea;
}

/* 操作面板 */
.operations-panel {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.operation-section {
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.desc {
  color: #666;
  margin-bottom: 1rem;
  font-size: 0.9rem;
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

.form-group small {
  display: block;
  margin-top: 0.25rem;
  color: #999;
  font-size: 0.85rem;
}

.input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
}

.input:focus {
  outline: none;
  border-color: #667eea;
}

.input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.input-with-button {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.input-with-button .input {
  flex: 1;
}

.btn-icon {
  padding: 0.75rem 1rem;
  min-width: 50px;
  height: 48px;
  border: none;
  border-radius: 6px;
  background: #f0f3ff;
  color: #667eea;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover:not(:disabled) {
  background: #667eea;
  color: white;
  transform: scale(1.05);
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.result-box {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  color: #667eea;
  border-radius: 6px;
  border: 1px solid #28a745;
}

.result-box code {
  display: block;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
  word-break: break-all;
}

.query-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.query-group {
  padding: 1rem;
  background: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.query-group h4 {
  margin: 0 0 1rem 0;
  color: #667eea;
  font-size: 0.95rem;
}

.query-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.control-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.input-sm {
  padding: 0.5rem;
  font-size: 0.9rem;
}

.btn-warning {
  background: #ffc107;
  color: #333;
}

.btn-warning:hover:not(:disabled) {
  background: #e0a800;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #218838;
}

/* 日志面板 */
.logs-panel {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
}

.logs-container {
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border-radius: 6px;
  padding: 1rem;
}

.no-logs {
  text-align: center;
  color: #999;
  padding: 2rem;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.log-item {
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
  color: #333;
}

/* 按钮样式 */
.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
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

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

/* 合约列表样式 */
.contracts-list {
  margin-top: 1rem;
}

.contracts-list h4 {
  margin-bottom: 1rem;
  color: #667eea;
  font-size: 1rem;
}

.contract-items {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.contract-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
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

.no-contracts {
  margin-top: 1rem;
  padding: 1.5rem;
  background: white;
  border: 2px dashed #ddd;
  border-radius: 8px;
  text-align: center;
  color: #999;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .contract-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .contract-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .contract-address {
    width: 100%;
  }
}
</style>
