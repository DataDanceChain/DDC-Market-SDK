<script setup lang="ts">
/**
 * HomePage - Wallet Type Selector
 *
 * Allows users to choose between different wallet connection methods:
 * - MetaMask: Traditional browser extension wallet
 * - Web3Auth: Social login with embedded wallets
 */

import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const sdkVersion = ref<string>('0.1.0');

function navigateToMetaMask() {
  router.push('/metamask');
}

function navigateToWeb3Auth() {
  router.push('/web3auth');
}

function navigateToJsonRpc() {
  router.push('/jsonrpc');
}
</script>

<template>
  <div class="home-container">
    <!-- Header -->
    <header class="home-header">
      <h1 class="title">DDC Market SDK Demo</h1>
      <p class="subtitle">Complete SDK Feature Testing Demo</p>
      <div class="version-badge">
        SDK Version: <code>v{{ sdkVersion }}</code>
      </div>
    </header>

    <!-- Main Content -->
    <main class="home-content">
      <section class="wallet-selection">
        <h2>Choose Your Wallet Connection Method</h2>
        <p class="description">
          Select how you want to connect your wallet to test the DDC Market SDK features
        </p>

        <div class="wallet-options">
          <!-- MetaMask Option -->
          <div class="wallet-card" @click="navigateToMetaMask">
            <div class="wallet-icon metamask-icon">
              <span class="icon-text">🦊</span>
            </div>
            <h3>MetaMask</h3>
            <p class="wallet-description">
              Connect using MetaMask browser extension or private key
            </p>
            <ul class="features">
              <li>Browser extension wallet</li>
              <li>Full control of your keys</li>
              <li>Widely supported</li>
            </ul>
            <button class="select-btn btn-metamask">Connect with MetaMask →</button>
          </div>

          <!-- Web3Auth Option -->
          <div class="wallet-card" @click="navigateToWeb3Auth">
            <div class="wallet-icon web3auth-icon">
              <span class="icon-text">🌐</span>
            </div>
            <h3>Web3Auth</h3>
            <p class="wallet-description">Connect using social accounts with embedded wallets</p>
            <ul class="features">
              <li>Social login (Google, Twitter, etc.)</li>
              <li>No extension required</li>
              <li>User-friendly experience</li>
            </ul>
            <button class="select-btn btn-web3auth">Connect with Web3Auth →</button>
          </div>

          <!-- JsonRpcProvider Option -->
          <div class="wallet-card" @click="navigateToJsonRpc">
            <div class="wallet-icon jsonrpc-icon">
              <span class="icon-text">🔗</span>
            </div>
            <h3>JsonRpcProvider</h3>
            <p class="wallet-description">
              Direct RPC connection with private key for server-side or automated testing
            </p>
            <ul class="features">
              <li>No wallet extension needed</li>
              <li>Direct blockchain connection</li>
              <li>Perfect for backend services</li>
            </ul>
            <button class="select-btn btn-jsonrpc">JsonRpcProvider Demo →</button>
          </div>
        </div>
      </section>

      <!-- Features Overview -->
      <section class="features-section">
        <h2>What You Can Test</h2>
        <div class="features-grid">
          <div class="feature-card">
            <h3>🎨 DDCNFT Workflow</h3>
            <ul>
              <li>Deploy NFT Factory & Contracts</li>
              <li>Mint & Transfer NFTs</li>
              <li>Query NFT Information</li>
              <li>Manage Contract Ownership</li>
            </ul>
          </div>

          <div class="feature-card">
            <h3>🎫 Membership Workflow</h3>
            <ul>
              <li>Deploy Membership Factory & Contracts</li>
              <li>Issue Membership Tokens</li>
              <li>Create & Query Snapshots</li>
              <li>Verify Membership Status</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Important Notes -->
      <section class="notes-section">
        <h3>⚠️ Important Notes</h3>
        <ul>
          <li>
            <strong>Test Network</strong>: Recommend testing on test networks (e.g. Sepolia, Goerli)
          </li>
          <li>
            <strong>Private Key Security</strong>: Never expose private keys in production or public
            settings
          </li>
          <li>
            <strong>Transaction Confirmation</strong>: On-chain operations require waiting for block
            confirmation
          </li>
        </ul>
      </section>
    </main>

    <!-- Footer -->
    <footer class="home-footer">
      <p>Built with Vite + Vue3 + TypeScript</p>
      <p>Powered by DDC Market SDK</p>
    </footer>
  </div>
</template>

<style scoped>
.home-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.home-header {
  text-align: center;
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid #f0f0f0;
}

.title {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: bold;
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
.home-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.wallet-selection {
  text-align: center;
}

.wallet-selection h2 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.description {
  color: #666;
  font-size: 1.1rem;
  margin-bottom: 2rem;
}

/* Wallet Options */
.wallet-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.wallet-card {
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s ease;
  border: 3px solid transparent;
}

.wallet-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.wallet-card:hover.wallet-card:nth-child(1) {
  border-color: #f6851b;
}

.wallet-card:hover.wallet-card:nth-child(2) {
  border-color: #667eea;
}

.wallet-card:hover.wallet-card:nth-child(3) {
  border-color: #f5576c;
}

.wallet-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
}

.metamask-icon {
  background: linear-gradient(135deg, #f6851b 0%, #e2761b 100%);
}

.web3auth-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.jsonrpc-icon {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.icon-text {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.wallet-card h3 {
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
  color: #333;
}

.wallet-description {
  color: #666;
  margin-bottom: 1.5rem;
  font-size: 1rem;
}

.features {
  list-style: none;
  padding: 0;
  margin: 1.5rem 0;
  text-align: left;
}

.features li {
  padding: 0.5rem 0;
  color: #555;
  position: relative;
  padding-left: 1.5rem;
}

.features li:before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #28a745;
  font-weight: bold;
}

.select-btn {
  width: 100%;
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 1rem;
}

.btn-metamask {
  background: linear-gradient(135deg, #f6851b 0%, #e2761b 100%);
  color: white;
}

.btn-metamask:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(246, 133, 27, 0.4);
}

.btn-web3auth {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-web3auth:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-jsonrpc {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.btn-jsonrpc:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(245, 87, 108, 0.4);
}

/* Features Section */
.features-section {
  padding: 2rem;
  background: #f8f9fa;
  border-radius: 12px;
}

.features-section h2 {
  text-align: center;
  margin-bottom: 2rem;
  color: #333;
  font-size: 1.8rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  border-left: 4px solid #667eea;
}

.feature-card h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #667eea;
  font-size: 1.3rem;
}

.feature-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.feature-card li {
  padding: 0.5rem 0;
  color: #555;
  position: relative;
  padding-left: 1.5rem;
}

.feature-card li:before {
  content: '•';
  position: absolute;
  left: 0;
  color: #667eea;
  font-weight: bold;
  font-size: 1.2rem;
}

/* Notes Section */
.notes-section {
  padding: 2rem;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 12px;
}

.notes-section h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  color: #856404;
}

.notes-section ul {
  margin: 0;
  padding-left: 1.5rem;
}

.notes-section li {
  margin-bottom: 0.75rem;
  color: #856404;
  line-height: 1.6;
}

.notes-section strong {
  color: #664d03;
}

/* Footer */
.home-footer {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 2px solid #f0f0f0;
  text-align: center;
  color: #999;
}

.home-footer p {
  margin: 0.5rem 0;
}

/* Responsive */
@media (max-width: 768px) {
  .home-container {
    padding: 1rem;
  }

  .title {
    font-size: 2rem;
  }

  .subtitle {
    font-size: 1rem;
  }

  .wallet-options {
    grid-template-columns: 1fr;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>
