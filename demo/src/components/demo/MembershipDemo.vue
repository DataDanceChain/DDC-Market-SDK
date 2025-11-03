<script setup lang="ts">
/**
 * MembershipDemo Component
 *
 * Demonstrates complete Membership SDK workflow:
 * 1. Deploy MembershipFactory contract
 * 2. Deploy Membership contract via factory
 * 3. Mint Token (issue membership card)
 * 4. Create Snapshot
 * 5. Query Snapshot (query snapshot members)
 * 6. Destroy Token (revoke membership card)
 * 7. Query contract information
 *
 * Usage:
 * - Must connect wallet first
 * - Execute steps in order
 * - Each step has detailed log output
 */

import { ref, computed } from 'vue'
import { MembershipManager, getKeyHash } from '@ddc-market/sdk'
import { useWalletStore } from '../../stores/wallet'

// ============================================================================
// Store
// ============================================================================
const walletStore = useWalletStore()

// ============================================================================
// State Management
// ============================================================================

// Manager instance
const membershipManager = ref<MembershipManager | null>(null)

// Contract addresses
const factoryAddress = ref<string>('')
const membershipContractAddress = ref<string>('')
const deployedContracts = ref<string[]>([]) // All deployed contracts
const selectedContract = ref<string>('') // Selected contract address

// Test data
const membershipName = ref('TestDAO')
const membershipSymbol = ref('TDAO')
const mintTokenId = ref('1')
const mintAddress = ref('0xcbb613c6da950ef270c99c0a70e81336e119e380') // Test address hash
const destroyAddres = ref('0x59dcc2997875272f7e3e9cfb3da7dbacd0948f85') // Address hash for destroy
const snapshotId = ref<string>('')
const destroyTokenId = ref('1') // Token ID to destroy
const newOwnerAddress = ref('') // New owner address for transferOwnership
const querySnapshotId = ref('0') // Snapshot ID for queries (default to 0)
const checkMemberAddress = ref('0xcbb613c6da950ef270c99c0a70e81336e119e380') // Address to check membership

// State management
const loading = ref(false)
const currentStep = ref(0)
const logs = ref<string[]>([])

// ============================================================================
// Computed
// ============================================================================

const isConnected = computed(() => walletStore.connected)
const canInitialize = computed(() => isConnected.value && currentStep.value === 0)
const canDeployMembership = computed(() => factoryAddress.value !== '')
const canMint = computed(() => membershipContractAddress.value !== '')
const canSnapshot = computed(() => currentStep.value >= 4)

// ============================================================================
// Methods
// ============================================================================

/**
 * Add log entry
 */
function addLog(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const timestamp = new Date().toLocaleTimeString()
  const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'
  logs.value.unshift(`[${timestamp}] ${prefix} ${message}`)
}

/**
 * Step 1: Initialize MembershipManager
 */
async function initializeManager() {
  if (!walletStore.provider || !walletStore.walletAddress) {
    addLog('Please connect wallet first', 'error')
    return
  }

  try {
    loading.value = true
    addLog('Initializing MembershipManager...')
    addLog(`Wallet Address: ${walletStore.walletAddress}`)

    // Initialize Manager
    membershipManager.value = await MembershipManager.init({
      walletAddress: walletStore.walletAddress,
      provider: walletStore.provider,
      debug: true
    })

    factoryAddress.value = membershipManager.value.getFactoryAddress()

    // Load all deployed contracts
    const contracts = membershipManager.value.getAllDeployedAddresses()
    deployedContracts.value = [...contracts]
    addLog(`Found ${contracts.length} deployed contracts`, 'info')

    addLog('MembershipManager initialized successfully', 'success')

    if (factoryAddress.value) {
      currentStep.value = 2
    } else {
      currentStep.value = 1
    }
  } catch (error: any) {
    addLog(`Initialization failed: ${error.message}`, 'error')
    console.error('Initialize error:', error)
  } finally {
    loading.value = false
  }
}

/**
 * Step 2: Deploy MembershipFactory contract
 */
async function deployFactory() {
  if (!membershipManager.value) {
    addLog('Please initialize Manager first', 'error')
    return
  }

  try {
    loading.value = true
    addLog('Deploying MembershipFactory contract...')
    addLog('This may take a few seconds, waiting for transaction confirmation...')

    // Deploy factory contract
    const result = await membershipManager.value.deployMembershipFactory()

    factoryAddress.value = result.contractAddress
    addLog(`Factory contract deployed successfully!`, 'success')
    addLog(`Factory Address: ${result.contractAddress}`)
    addLog(`Transaction Hash: ${result.transactionHash}`)
    addLog(`Block Number: ${result.blockNumber}`)

    currentStep.value = 2
  } catch (error: any) {
    addLog(`Factory deployment failed: ${error.message}`, 'error')
    console.error('Deploy factory error:', error)
  } finally {
    loading.value = false
  }
}

/**
 * Step 3: Deploy Membership contract via factory
 */
async function deployMembershipContract() {
  if (!membershipManager.value) {
    addLog('Please initialize Manager first', 'error')
    return
  }

  if (!membershipName.value || !membershipSymbol.value) {
    addLog('Please enter Membership name and symbol', 'error')
    return
  }

  try {
    loading.value = true
    addLog(`Deploying Membership contract: ${membershipName.value} (${membershipSymbol.value})...`)
    addLog('Deploying via factory contract, waiting for transaction confirmation...')

    // Deploy Membership contract via factory
    const result = await membershipManager.value.deployMembership(
      membershipName.value,
      membershipSymbol.value
    )

    membershipContractAddress.value = result.contractAddress
    addLog(`Membership contract deployed successfully!`, 'success')
    addLog(`Contract Address: ${result.contractAddress}`)
    addLog(`Transaction Hash: ${result.transactionHash}`)
    addLog(`Block Number: ${result.blockNumber}`)

    currentStep.value = 3
  } catch (error: any) {
    addLog(`Membership contract deployment failed: ${error.message}`, 'error')
    console.error('Deploy Membership error:', error)
  } finally {
    loading.value = false
  }
}

/**
 * Step 4: Mint Token (issue membership card)
 */
async function mintMembership() {
  if (!membershipManager.value) {
    addLog('Please initialize Manager first', 'error')
    return
  }

  if (!mintTokenId.value) {
    addLog('Please enter Token ID', 'error')
    return
  }

  try {
    loading.value = true
    addLog(`Minting Membership Token #${mintTokenId.value}...`)

    const tokenId = BigInt(mintTokenId.value)
    const addressHash = await getKeyHash(mintAddress.value)
    // Note: mintMembership method exists but TypeScript may not recognize it until SDK is rebuilt
    const result = await (membershipManager.value as any).mintMembership(tokenId, addressHash)

    addLog(`Membership Token minted successfully!`, 'success')
    addLog(`Token ID: ${result.tokenId.toString()}`)
    addLog(`Member Address Hash: ${result.to}`)
    addLog(`Transaction Hash: ${result.transactionHash}`)

    currentStep.value = 4
  } catch (error: any) {
    addLog(`Mint failed: ${error.message}`, 'error')
    console.error('Mint error:', error)
  } finally {
    loading.value = false
  }
}

/**
 * Step 5: Create Snapshot
 */
async function createSnapshot() {
  if (!membershipManager.value) {
    addLog('Please initialize Manager first', 'error')
    return
  }

  try {
    loading.value = true
    addLog('Creating member snapshot...')

    const newSnapshotId = await membershipManager.value.createSnapshot()
    snapshotId.value = newSnapshotId.toString()

    addLog(`Member snapshot created successfully!`, 'success')
    addLog(`Snapshot ID: ${snapshotId.value}`)

    currentStep.value = 5
  } catch (error: any) {
    addLog(`Snapshot creation failed: ${error.message}`, 'error')
    console.error('Create snapshot error:', error)
  } finally {
    loading.value = false
  }
}

/**
 * Query snapshot member list
 */
async function querySnapshot() {
  if (!membershipManager.value || !snapshotId.value) {
    addLog('Please create snapshot first', 'error')
    return
  }

  try {
    addLog(`Querying snapshot #${snapshotId.value} member list...`)

    const members = await membershipManager.value.getMemberSnapshot(BigInt(snapshotId.value))

    addLog(`Snapshot member count: ${members.length}`, 'success')
    members.forEach((member, index) => {
      addLog(`Member ${index + 1}: ${member}`)
    })
  } catch (error: any) {
    addLog(`Query failed: ${error.message}`, 'error')
  }
}

/**
 * Query latest snapshot ID
 */
async function queryLatestSnapshotId() {
  if (!membershipManager.value) return

  try {
    addLog('Querying latest snapshot ID...')
    const latestId = await membershipManager.value.getLatestSnapshotId()
    addLog(`Latest Snapshot ID: ${latestId.toString()}`, 'success')
  } catch (error: any) {
    addLog(`Query failed: ${error.message}`, 'error')
  }
}

/**
 * Query contract name
 */
async function queryName() {
  if (!membershipManager.value) return

  try {
    addLog('Querying Membership name...')
    const name = await membershipManager.value.getName()
    addLog(`Membership Name: ${name}`, 'success')
  } catch (error: any) {
    addLog(`Query failed: ${error.message}`, 'error')
  }
}

/**
 * Query contract symbol
 */
async function querySymbol() {
  if (!membershipManager.value) return

  try {
    addLog('Querying Membership symbol...')
    const symbol = await membershipManager.value.getSymbol()
    addLog(`Membership Symbol: ${symbol}`, 'success')
  } catch (error: any) {
    addLog(`Query failed: ${error.message}`, 'error')
  }
}

/**
 * Query total supply
 */
async function queryTotalSupply() {
  if (!membershipManager.value) return

  try {
    addLog('Querying total supply...')
    const supply = await membershipManager.value.getTotalSupply()
    addLog(`Total Supply: ${supply.toString()}`, 'success')
  } catch (error: any) {
    addLog(`Query failed: ${error.message}`, 'error')
  }
}

/**
 * Destroy Token
 */
async function destroyToken() {
  if (!membershipManager.value) {
    addLog('Please initialize Manager first', 'error')
    return
  }

  if (!destroyTokenId.value) {
    addLog('Please enter Token ID', 'error')
    return
  }

  try {
    loading.value = true
    addLog(`Destroying Membership Token #${destroyTokenId.value}...`)

    const tokenId = BigInt(destroyTokenId.value)
    const destroyAddressHash = await getKeyHash(destroyAddres.value)
    const result = await (membershipManager.value as any).destroyMembership(tokenId, destroyAddressHash)

    addLog(`Membership Token destroyed successfully!`, 'success')
    addLog(`Token ID: ${result.tokenId.toString()}`)
    addLog(`Previous Owner Hash: ${result.from}`)
    addLog(`Transaction Hash: ${result.transactionHash}`)
  } catch (error: any) {
    addLog(`Destroy failed: ${error.message}`, 'error')
    console.error('Destroy error:', error)
  } finally {
    loading.value = false
  }
}

/**
 * Load all deployed contracts
 */
async function loadDeployedContracts() {
  if (!membershipManager.value) {
    addLog('Please initialize Manager first', 'error')
    return
  }

  try {
    addLog('Loading deployed contracts...')
    const contracts = membershipManager.value.getAllDeployedAddresses()
    deployedContracts.value = [...contracts]
    addLog(`Found ${contracts.length} deployed contract(s)`, 'success')
    
    if (contracts.length > 0) {
      addLog('You can select a contract to interact with', 'info')
    }
  } catch (error: any) {
    addLog(`Failed to load contracts: ${error.message}`, 'error')
    console.error('Load contracts error:', error)
  }
}

/**
 * Select and use a deployed contract
 */
async function selectContract(address: string) {
  if (!membershipManager.value) {
    addLog('Please initialize Manager first', 'error')
    return
  }

  try {
    loading.value = true
    addLog(`Selecting contract: ${address}`)
    
    // Set current contract address
    membershipManager.value.setContractAddress(address)
    
    // Verify contract is accessible and get contract info
    const contract = await membershipManager.value.getContract()
    
    let name = 'Unknown'
    let symbol = 'Unknown'
    try {
      if (contract.name) {
        name = await contract.name()
      }
      if (contract.symbol) {
        symbol = await contract.symbol()
      }
    } catch (queryError) {
      console.warn('Could not query contract name/symbol:', queryError)
    }
    
    // Update UI state
    membershipContractAddress.value = address
    selectedContract.value = address
    
    addLog(`Contract selected successfully!`, 'success')
    addLog(`Name: ${name}, Symbol: ${symbol}`)
    addLog(`Address: ${address}`)
    
    // If current step is still in deployment phase, jump to operation phase
    if (currentStep.value < 3) {
      currentStep.value = 3
    }
  } catch (error: any) {
    addLog(`Failed to select contract: ${error.message}`, 'error')
    console.error('Select contract error:', error)
  } finally {
    loading.value = false
  }
}

/**
 * Transfer Ownership
 */
async function transferContractOwnership() {
  if (!membershipManager.value) {
    addLog('Please initialize Manager first', 'error')
    return
  }

  if (!newOwnerAddress.value || !newOwnerAddress.value.trim()) {
    addLog('Please enter new owner address', 'error')
    return
  }

  try {
    loading.value = true
    addLog(`Transferring contract ownership to ${newOwnerAddress.value}...`)
    const txHash = await membershipManager.value.transferOwnership(newOwnerAddress.value)
    addLog('Contract ownership transferred successfully!', 'success')
    addLog(`New Owner: ${newOwnerAddress.value}`)
    addLog(`Transaction Hash: ${txHash}`)
  } catch (error: any) {
    addLog(`Transfer ownership failed: ${error.message}`, 'error')
    console.error('Transfer ownership error:', error)
  } finally {
    loading.value = false
  }
}

/**
 * Check if member is in snapshot
 */
async function checkMemberInSnapshot() {
  if (!membershipManager.value) {
    addLog('Please initialize Manager first', 'error')
    return
  }

  if (!checkMemberAddress.value || !checkMemberAddress.value.trim()) {
    addLog('Please enter member address', 'error')
    return
  }

  try {
    loading.value = true
    addLog(`Checking membership for address: ${checkMemberAddress.value}`)
    addLog(`In snapshot #${querySnapshotId.value}...`)
    
    // Convert address to hash
    const addressHash = await getKeyHash(checkMemberAddress.value)
    addLog(`Address hash: ${addressHash}`, 'info')
    
    // Check membership
    const isMember = await membershipManager.value.isMemberInSnapshot(
      BigInt(querySnapshotId.value),
      addressHash
    )
    
    if (isMember) {
      addLog(`✅ Address IS a member in snapshot #${querySnapshotId.value}`, 'success')
    } else {
      addLog(`❌ Address IS NOT a member in snapshot #${querySnapshotId.value}`, 'error')
    }
    
    addLog(`Member Address: ${checkMemberAddress.value}`)
    addLog(`Snapshot ID: ${querySnapshotId.value}`)
  } catch (error: any) {
    addLog(`Membership check failed: ${error.message}`, 'error')
    console.error('Check membership error:', error)
  } finally {
    loading.value = false
  }
}

/**
 * Reset all state
 */
function reset() {
  membershipManager.value = null
  factoryAddress.value = ''
  membershipContractAddress.value = ''
  deployedContracts.value = []
  selectedContract.value = ''
  snapshotId.value = ''
  querySnapshotId.value = ''
  newOwnerAddress.value = ''
  currentStep.value = 0
  logs.value = []
  addLog('All state reset')
}
</script>

<template>
  <div class="membership-demo">
    <h2>🎫 Membership Workflow Demo</h2>

    <!-- Connection Warning -->
    <div v-if="!isConnected" class="warning-box">
      ⚠️ Please connect wallet first to use Membership features
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
          <div class="step-label">Deploy Membership</div>
        </div>
        <div class="step-line" :class="{ active: currentStep > 2 }"></div>
        <div class="step" :class="{ active: currentStep >= 3, completed: currentStep > 3 }">
          <div class="step-number">4</div>
          <div class="step-label">Mint</div>
        </div>
        <div class="step-line" :class="{ active: currentStep > 3 }"></div>
        <div class="step" :class="{ active: currentStep >= 4, completed: currentStep > 4 }">
          <div class="step-number">5</div>
          <div class="step-label">Snapshot</div>
        </div>
      </div>

      <!-- Operations Panel -->
      <div class="operations-panel">
        <!-- Step 1: Initialize -->
        <div class="operation-section">
          <h3>Step 1: Initialize MembershipManager</h3>
          <p class="desc">Initialize SDK manager instance</p>
          <button
            @click="initializeManager"
            :disabled="!canInitialize || loading"
            class="btn btn-primary"
          >
            {{ loading && currentStep === 0 ? 'Initializing...' : 'Initialize Manager' }}
          </button>
        </div>

        <!-- Step 2: Deploy Factory -->
        <div v-if="currentStep >= 1" class="operation-section">
          <h3>Step 2: Deploy MembershipFactory</h3>
          <p class="desc">Deploy factory contract for subsequent Membership contract deployments</p>
          <button
            @click="deployFactory"
            :disabled="loading"
            class="btn btn-primary"
          >
            {{ loading && currentStep === 1 ? 'Deploying...' : 'Deploy Factory Contract' }}
          </button>
          <div v-if="factoryAddress" class="result-box">
            <strong>Factory Address:</strong>
            <code>{{ factoryAddress }}</code>
          </div>
        </div>

        <!-- Step 3: Deploy Membership -->
        <div v-if="currentStep >= 2" class="operation-section">
          <h3>Step 3: Deploy Membership Contract</h3>
          <p class="desc">Deploy Membership contract via factory</p>
          <div class="form-group">
            <label>Membership Name:</label>
            <input v-model="membershipName" type="text" placeholder="TestDAO" class="input" />
          </div>
          <div class="form-group">
            <label>Membership Symbol:</label>
            <input v-model="membershipSymbol" type="text" placeholder="TDAO" class="input" />
          </div>
          <button
            @click="deployMembershipContract"
            :disabled="!canDeployMembership || loading"
            class="btn btn-primary"
          >
            {{ loading && currentStep === 2 ? 'Deploying...' : 'Deploy Membership Contract' }}
          </button>
          <div v-if="membershipContractAddress" class="result-box">
            <strong>Membership Contract Address:</strong>
            <code>{{ membershipContractAddress }}</code>
          </div>
        </div>

        <!-- Contract Information Query -->
        <div v-if="currentStep >= 3" class="operation-section">
          <h3>🔍 Contract Information</h3>
          <div class="query-buttons">
            <button @click="queryName" class="btn btn-secondary btn-sm" :disabled="loading">
              Query Name
            </button>
            <button @click="querySymbol" class="btn btn-secondary btn-sm" :disabled="loading">
              Query Symbol
            </button>
            <button @click="queryTotalSupply" class="btn btn-secondary btn-sm" :disabled="loading">
              Query Total Supply
            </button>
          </div>
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
                  <span v-if="contract === membershipContractAddress" class="badge badge-current">
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

        <!-- Step 4: Mint Token -->
        <div v-if="currentStep >= 3" class="operation-section">
          <h3>Step 4: Mint Token (Issue Membership Card)</h3>
          <p class="desc">Issue membership token to member</p>
          <div class="form-group">
            <label>Token ID:</label>
            <input v-model="mintTokenId" type="number" placeholder="1" class="input" />
          </div>
          <div class="form-group">
            <label>Member Address Hash:</label>
            <input
              v-model="mintAddress"
              type="text"
              placeholder="0x..."
              class="input"
              disabled
            />
            <small>Member address hash (test fixed value)</small>
          </div>
          <button
            @click="mintMembership"
            :disabled="!canMint || loading"
            class="btn btn-primary"
          >
            {{ loading && currentStep === 3 ? 'Minting...' : 'Mint Token' }}
          </button>
        </div>

        <!-- Step 5: Create Snapshot -->
        <div v-if="selectedContract" class="operation-section">
          <h3>Step 5: Create Snapshot</h3>
          <p class="desc">Create snapshot of all current members for governance voting scenarios</p>
          <button
            @click="createSnapshot"
            :disabled="!canSnapshot || loading"
            class="btn btn-primary"
          >
            {{ loading && currentStep === 4 ? 'Creating...' : 'Create Snapshot' }}
          </button>
          <div v-if="snapshotId" class="result-box">
            <strong>Snapshot ID:</strong>
            <code>{{ snapshotId }}</code>
          </div>
        </div>

        <!-- Note: Transfer Token feature is commented out as Membership tokens are typically non-transferable (soulbound) -->
        <!-- <div v-if="currentStep >= 3" class="operation-section">
          <h3>🔄 Transfer Token</h3>
          <p class="desc">⚠️ Membership tokens are typically non-transferable (soulbound tokens)</p>
        </div> -->

        <!-- Enhanced Snapshot Query -->
        <div v-if="currentStep >= 5" class="operation-section">
          <h3>📊 Snapshot Management</h3>
          <div class="query-section">
            <div class="query-group">
              <h4>Snapshot Queries</h4>
              <div class="query-buttons">
                <button @click="querySnapshot" class="btn btn-secondary btn-sm" :disabled="loading">
                  Query Snapshot Members
                </button>
                <button @click="queryLatestSnapshotId" class="btn btn-secondary btn-sm" :disabled="loading">
                  Query Latest Snapshot ID
                </button>
              </div>
            </div>

            <div class="query-group">
              <h4>🔍 Check Member in Snapshot</h4>
              <p class="desc" style="margin-bottom: 0.5rem; font-size: 0.85rem;">
                Verify if a specific address is a member in a snapshot
              </p>
              <div class="form-group">
                <label>Snapshot ID:</label>
                <input
                  v-model="querySnapshotId"
                  type="number"
                  placeholder="Enter snapshot ID (e.g., 1)"
                  class="input input-sm"
                />
                <small>The snapshot ID to check (use "Query Latest Snapshot ID" to find)</small>
              </div>
              <div class="form-group">
                <label>Member Address:</label>
                <input
                  v-model="checkMemberAddress"
                  type="text"
                  placeholder="0xcbb613c6da950ef270c99c0a70e81336e119e380"
                  class="input input-sm"
                />
                <small>The Ethereum address to check for membership (will be converted to hash automatically)</small>
              </div>
              <button 
                @click="checkMemberInSnapshot" 
                class="btn btn-primary btn-sm" 
                :disabled="loading || !querySnapshotId || !checkMemberAddress"
              >
                {{ loading ? 'Checking...' : '🔍 Check Membership' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Standalone Membership Check (Available from Step 3) -->
        <div v-if="currentStep >= 3" class="operation-section">
          <h3>👥 Membership Verification</h3>
          <p class="desc">Check if a specific address is a member in any snapshot</p>
          
          <div class="query-section">
            <div class="query-group">
              <h4>🔍 Quick Membership Check</h4>
              <div class="form-group">
                <label>Snapshot ID:</label>
                <input
                  v-model="querySnapshotId"
                  type="number"
                  placeholder="Enter snapshot ID"
                  class="input input-sm"
                />
                <small>The snapshot ID to check against</small>
              </div>
              <div class="form-group">
                <label>Member Address:</label>
                <input
                  v-model="checkMemberAddress"
                  type="text"
                  placeholder="0xcbb613c6da950ef270c99c0a70e81336e119e380"
                  class="input"
                />
                <small>Ethereum address to verify (auto-converts to hash)</small>
              </div>
              <button 
                @click="checkMemberInSnapshot" 
                class="btn btn-primary" 
                :disabled="loading"
              >
                {{ loading ? 'Verifying...' : '🔍 Verify Membership' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Note: Pause/Unpause functionality may not be available for Membership contract -->
        <!-- <div v-if="currentStep >= 3" class="operation-section">
          <h3>⚙️ Contract Control</h3>
          <p class="desc">⚠️ Pause/Unpause functionality not available for Membership contract</p>
        </div> -->

        <!-- Transfer Contract Ownership -->
        <div v-if="currentStep >= 3" class="operation-section">
          <h3>👑 Transfer Contract Ownership</h3>
          <p class="desc">Transfer contract ownership to another address (owner only, irreversible!)</p>
          <div class="form-group">
            <label>New Owner Address:</label>
            <input
              v-model="newOwnerAddress"
              type="text"
              placeholder="0x..."
              class="input"
            />
            <small>⚠️ Warning: This action is irreversible. The new owner will have full control of the contract.</small>
          </div>
          <button
            @click="transferContractOwnership"
            :disabled="loading || !newOwnerAddress"
            class="btn btn-warning"
          >
            {{ loading ? 'Transferring...' : '👑 Transfer Ownership' }}
          </button>
        </div>

        <!-- Destroy Token -->
        <div  class="operation-section">
          <h3>🔥 Destroy Token</h3>
          <p class="desc">Permanently destroy (revoke) a membership token</p>
          <div class="form-group">
            <label>Token ID to Destroy:</label>
            <input
              v-model="destroyTokenId"
              type="number"
              placeholder="1"
              class="input"
            />
          </div>
          <div class="form-group">
            <label>Address Hash:</label>
            <input
              v-model="destroyAddres"
              type="text"
              placeholder="0x..."
              class="input"
            />
            <small>Address hash of the token owner</small>
          </div>
          <button
            @click="destroyToken"
            :disabled="loading || !destroyTokenId"
            class="btn btn-danger"
          >
            {{ loading ? 'Destroying...' : '🔥 Destroy Token' }}
          </button>
        </div>

        <!-- Reset Button -->
        <div v-if="currentStep > 0" class="operation-section">
          <button @click="reset" class="btn btn-danger">
            🔄 Reset All State
          </button>
        </div>
      </div>

      <!-- Logs Panel -->
      <div class="logs-panel">
        <h3>📋 Operation Logs</h3>
        <div class="logs-container">
          <div v-if="logs.length === 0" class="no-logs">
            No logs yet
          </div>
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
/* 样式与 DDCNFTDemo 相同，保持一致性 */
.membership-demo {
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

.result-box {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #28a745;
  color: #667eea;
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

.query-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
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
</style>
