<script setup lang="ts">
import { useRouter } from 'vue-router';
import MerchantDemo from '../components/demo/MerchantDemo.vue';

const router = useRouter();

function goBack() {
  router.push('/');
}
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <button @click="goBack" class="back-button">← Back to Home</button>
      <h1 class="title">Merchant Authorization Demo</h1>
      <div class="mode-badge">Merchant Auth + App API</div>
      <p class="subtitle">测试商户授权流程：链上授权、撤销、查询授权状态、App 专用接口</p>
    </header>

    <main class="main-content">
      <MerchantDemo />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
}

.app-header {
  position: relative;
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 2px solid #f0f0f0;
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
}

.back-button:hover {
  background: #52c41a;
  color: #fff;
  border-color: #52c41a;
}

.title {
  font-size: 2.25rem;
  margin-bottom: 0.5rem;
  color: #1f2937;
}

.mode-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  color: #fff;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.subtitle {
  color: #666;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
