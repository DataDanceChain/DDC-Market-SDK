<script setup lang="ts">
/**
 * JsonRpcProvider Mode Application
 *
 * This page demonstrates JsonRpcProvider mode functionality
 * Features:
 * 1. JsonRpcProvider initialization (no wallet connection needed)
 * 2. DDCNFT workflow testing with private key
 */

import { useRouter } from 'vue-router';
import JsonRpcProviderDemo from '../components/demo/JsonRpcProviderDemo.vue';

const router = useRouter();

function goBack() {
  router.push('/');
}
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <button @click="goBack" class="back-button">← Back to Home</button>
      <h1 class="title">JsonRpcProvider Mode Demo</h1>
      <div class="wallet-mode-badge jsonrpc-mode">🔗 JsonRpcProvider Mode</div>
      <p class="subtitle">Direct RPC connection with private key</p>
    </header>

    <!-- Main Content -->
    <main class="main-content">
      <section class="section">
        <JsonRpcProviderDemo />
      </section>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.app-header {
  background: white;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.back-button {
  position: absolute;
  left: 2rem;
  top: 2rem;
  padding: 0.5rem 1rem;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.back-button:hover {
  background: #5a6268;
}

.title {
  margin: 0.5rem 0;
  color: #333;
}

.wallet-mode-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: 600;
  margin: 0.5rem 0;
}

.jsonrpc-mode {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.subtitle {
  color: #666;
  margin: 0.5rem 0;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.section {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
