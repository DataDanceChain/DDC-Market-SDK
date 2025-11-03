<script setup lang="ts">
/**
 * MetaMask Wallet Mode Application
 *
 * This page uses MetaMask wallet connection mode
 * Features:
 * 1. MetaMask wallet connection
 * 2. DDCNFT workflow testing
 * 3. Membership workflow testing
 */

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useWalletStore } from '../stores/wallet'
import WalletConnector from '../components/demo/WalletConnector.vue'
import DDCNFTDemo from '../components/demo/DDCNFTDemo.vue'
import MembershipDemo from '../components/demo/MembershipDemo.vue'

// ============================================================================
// State Management
// ============================================================================

const router = useRouter()
const walletStore = useWalletStore()

// Current active tab
const activeTab = ref<'nft' | 'membership'>('nft')

// SDK version information
const sdkVersion = ref<string>('0.1.0')

// ============================================================================
// Methods
// ============================================================================

/**
 * Switch tab
 */
function switchTab(tab: 'nft' | 'membership') {
  activeTab.value = tab
}

/**
 * Go back to home page
 */
function goBack() {
  // Clear wallet connection when going back
  walletStore.clear()
  router.push('/')
}
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <button @click="goBack" class="back-button">← Back to Home</button>
      <h1 class="title">DDC Market SDK Demo</h1>
      <div class="wallet-mode-badge metamask-mode">
        🦊 MetaMask Mode
      </div>
      <p class="subtitle">MetaMask Wallet Connection Mode</p>
      <div class="version-badge">
        SDK Version: <code>v{{ sdkVersion }}</code>
      </div>
    </header>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Wallet Connector -->
      <section class="section">
        <WalletConnector />
      </section>

      <!-- Feature Tabs -->
      <section v-if="walletStore.connected" class="section">
        <div class="tabs">
          <button
            @click="switchTab('nft')"
            :class="['tab-button', { active: activeTab === 'nft' }]"
          >
            🎨 DDCNFT Test
          </button>
          <button
            @click="switchTab('membership')"
            :class="['tab-button', { active: activeTab === 'membership' }]"
          >
            🎫 Membership Test
          </button>
        </div>

        <div class="tab-content">
          <!-- DDCNFT Tab -->
          <div v-show="activeTab === 'nft'" class="tab-panel">
            <DDCNFTDemo />
          </div>

          <!-- Membership Tab -->
          <div v-show="activeTab === 'membership'" class="tab-panel">
            <MembershipDemo />
          </div>
        </div>
      </section>

      <!-- Usage Instructions -->
      <section class="section info-section">
        <h2>ℹ️ Usage Instructions</h2>
        <div class="info-grid">

          <div class="info-card">
            <h3>🎯 DDCNFT Workflow</h3>
            <ol>
              <li>Initialize Manager <strong>(Only once in your application)</strong></li>
              <li>Deploy Factory Contract <strong>(Only once before deploying any NFT contract)</strong></li>
              <li>Deploy NFT Contract (Every time you need a new NFT contract)</li>
              <li>--------------- NFT Methods -----------------</li>
              <li>Mint NFT</li>
              <li>Transfer NFT</li>
            </ol>
          </div>

          <div class="info-card">
            <h3>🎫 Membership Workflow</h3>
            <ol>
              <li>Initialize Manager <strong>(Only once in your application)</strong></li>
              <li>Deploy Factory Contract <strong>(Only once before deploying any Membership contract)</strong></li>
              <li>Deploy Membership Contract (Every time you need a new Membership contract)</li>
              <li>--------------- Membership Methods -----------------</li>
              <li>Mint Token</li>
              <li>Create Snapshot</li>
            </ol>
          </div>
        </div>
      </section>

      <!-- Important Notes -->
      <section class="section warning-section">
        <h3>⚠️ Important Notes</h3>
        <ul>
          <li><strong>Test Network</strong>: Recommend testing on test networks (e.g. Sepolia, Goerli)</li>
          <li><strong>Private Key Security</strong>: Never expose private keys in production or public settings</li>
          <li><strong>Transaction Confirmation</strong>: On-chain operations require waiting for block confirmation, please be patient</li>
        </ul>
      </section>
    </main>

    <!-- Footer -->
    <footer class="app-footer">
      <p>Built with Vite + Vue3 + TypeScript</p>
      <p>Powered by DDC Market SDK</p>
    </footer>
  </div>
</template>

<style scoped>
.app-container {
  max-width: 80%;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.app-header {
  text-align: center;
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid #f0f0f0;
  position: relative;
}

.back-button {
  position: absolute;
  left: 0;
  top: 0;
  padding: 0.5rem 1rem;
  background: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  color: #555;
  transition: all 0.3s ease;
}

.back-button:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.title {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: bold;
}

.wallet-mode-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.metamask-mode {
  background: linear-gradient(135deg, #f6851b 0%, #e2761b 100%);
  color: white;
}

.subtitle {
  color: #666;
  font-size: 1.2rem;
  margin-bottom: 1rem;
}

.version-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: #0066cc;
  color: #fff;
  border-radius: 20px;
  font-size: 0.9rem;
}

.version-badge code {
  color: #fff;
  font-weight: bold;
}

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.section {
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

/* Tabs */
.tabs {
  display: flex;
  background: #f8f9fa;
  border-bottom: 2px solid #e0e0e0;
}

.tab-button {
  flex: 1;
  padding: 1.25rem;
  border: none;
  background: transparent;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #666;
}

.tab-button:hover {
  background: rgba(102, 126, 234, 0.1);
}

.tab-button.active {
  background: white;
  color: #667eea;
  border-bottom: 3px solid #667eea;
}

.tab-content {
  background: white;
}

.tab-panel {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Info Section */
.info-section {
  padding: 2rem;
}

.info-section h2 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #333;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.info-card {
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.info-card h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #667eea;
  font-size: 1.1rem;
}

.info-card ul,
.info-card ol {
  margin: 0;
  padding-left: 1.5rem;
}

.info-card li {
  margin-bottom: 0.5rem;
  color: #555;
  line-height: 1.6;
}

.info-card code {
  background: rgba(102, 126, 234, 0.1);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
}

/* Warning Section */
.warning-section {
  padding: 2rem;
  background: #fff3cd;
  border: 1px solid #ffc107;
}

.warning-section h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #856404;
}

.warning-section ul {
  margin: 0;
  padding-left: 1.5rem;
}

.warning-section li {
  margin-bottom: 0.75rem;
  color: #856404;
  line-height: 1.6;
}

.warning-section strong {
  color: #664d03;
}

/* Footer */
.app-footer {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 2px solid #f0f0f0;
  text-align: center;
  color: #999;
}

.app-footer p {
  margin: 0.5rem 0;
}

/* Responsive */
@media (max-width: 768px) {
  .app-container {
    padding: 1rem;
  }

  .title {
    font-size: 2rem;
  }

  .subtitle {
    font-size: 1rem;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .tabs {
    flex-direction: column;
  }

  .tab-button {
    border-bottom: 1px solid #e0e0e0;
  }

  .tab-button.active {
    border-left: 4px solid #667eea;
    border-bottom: 1px solid #e0e0e0;
  }

  .back-button {
    position: static;
    margin-bottom: 1rem;
  }
}
</style>
