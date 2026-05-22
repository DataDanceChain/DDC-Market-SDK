<script setup lang="ts">
import { useRouter } from 'vue-router';
import AdminDemo from '../components/demo/AdminDemo.vue';

const router = useRouter();

function goBack() {
  router.push('/');
}
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <button @click="goBack" class="back-button">← Back to Home</button>
      <h1 class="title">Admin API Demo</h1>
      <div class="mode-badge">Admin Merchant CRUD</div>
      <p class="subtitle">测试管理端商户接口的查询、新增、更新和停用</p>
    </header>

    <main class="main-content">
      <AdminDemo />
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
  background: #1677ff;
  color: #fff;
  border-color: #1677ff;
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
  background: linear-gradient(135deg, #1677ff 0%, #0f4cbd 100%);
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
