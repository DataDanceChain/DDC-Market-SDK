<script setup lang="ts">
import { ref } from 'vue';
import { Admin, httpService } from '@ddcmarket/sdk';

type MerchantListResult = Awaited<ReturnType<Admin['queryMerchantList']>>;
type MerchantDetail = Awaited<ReturnType<Admin['createMerchant']>>;

const admin = new Admin();

const baseURL = ref('https://dev-mkt-engine.datadance.co/api/v1/');
const jwtSecret = ref('');
const jwtTtl = ref(300);

const queryForm = ref({
  page: 0,
  pageSize: 10,
  keyword: '',
  status: '',
});

const createForm = ref({
  domain: '',
  name: '',
  logo: '',
  status: 1,
});

const updateForm = ref({
  id: '',
  domain: '',
  name: '',
  logo: '',
  status: '',
});

const disableMerchantId = ref('');

const loading = ref(false);
const statusMessage = ref('请先填写 Base URL 和 JWT Secret，然后测试四个 CRUD 接口。');
const merchantList = ref<MerchantListResult | null>(null);
const selectedMerchant = ref<MerchantDetail | null>(null);
const disableResult = ref<boolean | null>(null);
const lastError = ref<unknown>(null);
const logs = ref<string[]>([]);

function addLog(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const prefix = type === 'success' ? '[SUCCESS]' : type === 'error' ? '[ERROR]' : '[INFO]';
  const timestamp = new Date().toLocaleTimeString();
  logs.value.unshift(`${timestamp} ${prefix} ${message}`);
}

function applyHttpConfig() {
  const normalizedBaseURL = baseURL.value.trim();
  if (!normalizedBaseURL) {
    throw new Error('Base URL 不能为空');
  }

  httpService.setBaseURL(normalizedBaseURL);
  admin.setAuth(jwtSecret.value.trim(), Number(jwtTtl.value));
}

async function runAction(actionName: string, handler: () => Promise<void>) {
  if (loading.value) return;

  try {
    loading.value = true;
    lastError.value = null;
    applyHttpConfig();
    statusMessage.value = `${actionName}执行中...`;
    addLog(`${actionName}开始`);
    await handler();
  } catch (error: any) {
    lastError.value = error;
    statusMessage.value = error?.message || `${actionName}失败`;
    addLog(`${actionName}失败: ${statusMessage.value}`, 'error');
    console.error(`${actionName} error`, error);
  } finally {
    loading.value = false;
  }
}

async function queryMerchants() {
  await runAction('查询商户列表', async () => {
    const result = await admin.queryMerchantList({
      page: Number(queryForm.value.page),
      pageSize: Number(queryForm.value.pageSize),
      keyword: queryForm.value.keyword.trim() || undefined,
      status: queryForm.value.status === '' ? undefined : Number(queryForm.value.status),
    });

    merchantList.value = result;
    statusMessage.value = `查询成功，共 ${result.total} 条数据`;
    addLog(`查询成功，返回 ${result.rows.length} 条数据`, 'success');
  });
}

async function createMerchant() {
  await runAction('创建商户', async () => {
    const result = await admin.createMerchant({
      domain: createForm.value.domain.trim(),
      name: createForm.value.name.trim(),
      logo: createForm.value.logo.trim() || undefined,
      status: Number(createForm.value.status),
    });

    selectedMerchant.value = result;
    updateForm.value.id = String(result.id);
    updateForm.value.domain = result.domain;
    updateForm.value.name = result.name;
    updateForm.value.logo = result.logo || '';
    updateForm.value.status = String(result.status);
    disableMerchantId.value = String(result.id);
    statusMessage.value = `创建成功，商户 ID: ${result.id}`;
    addLog(`创建成功，商户 ID: ${result.id}`, 'success');
  });
}

async function updateMerchant() {
  await runAction('更新商户', async () => {
    const result = await admin.updateMerchant({
      id: Number(updateForm.value.id),
      domain: updateForm.value.domain.trim() || undefined,
      name: updateForm.value.name.trim() || undefined,
      logo: updateForm.value.logo.trim() || undefined,
      status: updateForm.value.status === '' ? undefined : Number(updateForm.value.status),
    });

    selectedMerchant.value = result;
    statusMessage.value = `更新成功，商户 ID: ${result.id}`;
    addLog(`更新成功，商户 ID: ${result.id}`, 'success');
  });
}

async function disableMerchant() {
  await runAction('停用商户', async () => {
    const result = await admin.disableMerchant(Number(disableMerchantId.value));
    disableResult.value = result;
    statusMessage.value = `停用结果: ${String(result)}`;
    addLog(`停用结果: ${String(result)}`, 'success');
  });
}

function fillFromMerchant(merchant: MerchantDetail) {
  selectedMerchant.value = merchant;
  updateForm.value.id = String(merchant.id);
  updateForm.value.domain = merchant.domain;
  updateForm.value.name = merchant.name;
  updateForm.value.logo = merchant.logo || '';
  updateForm.value.status = String(merchant.status);
  disableMerchantId.value = String(merchant.id);
  statusMessage.value = `已载入商户 ${merchant.id} 到更新表单`;
  addLog(`已载入商户 ${merchant.id} 到更新表单`);
}
</script>

<template>
  <div class="admin-demo">
    <header class="section-header">
      <h2>Admin API Demo</h2>
      <p class="subtitle">测试管理员商户 CRUD 封装、错误处理和 data 解包返回。</p>
    </header>

    <section class="card">
      <h3>接口配置</h3>
      <div class="grid three-columns">
        <label class="field">
          <span>Base URL</span>
          <input v-model="baseURL" placeholder="http://localhost:3000" />
        </label>
        <label class="field">
          <span>JWT Secret</span>
          <input v-model="jwtSecret" placeholder="与服务端共享的密钥" />
        </label>
        <label class="field">
          <span>JWT TTL (秒)</span>
          <input v-model.number="jwtTtl" type="number" min="1" placeholder="300" />
        </label>
      </div>
    </section>

    <section class="card">
      <h3>查询商户列表</h3>
      <div class="grid four-columns">
        <label class="field">
          <span>Page</span>
          <input v-model.number="queryForm.page" type="number" min="0" />
        </label>
        <label class="field">
          <span>Page Size</span>
          <input v-model.number="queryForm.pageSize" type="number" min="1" max="20" />
        </label>
        <label class="field">
          <span>Keyword</span>
          <input v-model="queryForm.keyword" placeholder="domain / name / appId / siteId" />
        </label>
        <label class="field">
          <span>Status</span>
          <select v-model="queryForm.status">
            <option value="">全部</option>
            <option value="0">0</option>
            <option value="1">1</option>
          </select>
        </label>
      </div>
      <button class="primary-button" :disabled="loading" @click="queryMerchants">查询列表</button>
    </section>

    <section class="card">
      <h3>创建商户</h3>
      <div class="grid two-columns">
        <label class="field">
          <span>Domain</span>
          <input v-model="createForm.domain" placeholder="merchant.example.com" />
        </label>
        <label class="field">
          <span>Name</span>
          <input v-model="createForm.name" placeholder="Merchant Name" />
        </label>
        <label class="field">
          <span>Logo</span>
          <input v-model="createForm.logo" placeholder="https://example.com/logo.png" />
        </label>
        <label class="field">
          <span>Status</span>
          <select v-model.number="createForm.status">
            <option :value="0">0</option>
            <option :value="1">1</option>
          </select>
        </label>
      </div>
      <button class="primary-button" :disabled="loading" @click="createMerchant">创建商户</button>
    </section>

    <section class="card">
      <h3>更新商户</h3>
      <div class="grid two-columns">
        <label class="field">
          <span>ID</span>
          <input v-model="updateForm.id" type="number" min="1" placeholder="商户 ID" />
        </label>
        <label class="field">
          <span>Status</span>
          <select v-model="updateForm.status">
            <option value="">不修改</option>
            <option value="0">0</option>
            <option value="1">1</option>
          </select>
        </label>
        <label class="field">
          <span>Domain</span>
          <input v-model="updateForm.domain" placeholder="可选" />
        </label>
        <label class="field">
          <span>Name</span>
          <input v-model="updateForm.name" placeholder="可选" />
        </label>
        <label class="field full-width">
          <span>Logo</span>
          <input v-model="updateForm.logo" placeholder="可选" />
        </label>
      </div>
      <button class="primary-button" :disabled="loading" @click="updateMerchant">更新商户</button>
    </section>

    <section class="card">
      <h3>停用商户</h3>
      <div class="grid single-column">
        <label class="field">
          <span>Merchant ID</span>
          <input v-model="disableMerchantId" type="number" min="1" placeholder="商户 ID" />
        </label>
      </div>
      <button class="danger-button" :disabled="loading" @click="disableMerchant">停用商户</button>
    </section>

    <section class="card">
      <h3>执行结果</h3>
      <p class="status">{{ loading ? '执行中...' : statusMessage }}</p>

      <div v-if="selectedMerchant" class="result-block">
        <div class="result-header">
          <h4>最近商户结果</h4>
          <button class="secondary-button" @click="fillFromMerchant(selectedMerchant)">
            载入更新表单
          </button>
        </div>
        <pre>{{ JSON.stringify(selectedMerchant, null, 2) }}</pre>
      </div>

      <div v-if="merchantList" class="result-block">
        <h4>商户列表</h4>
        <pre>{{ JSON.stringify(merchantList, null, 2) }}</pre>
      </div>

      <div v-if="disableResult !== null" class="result-block">
        <h4>停用结果</h4>
        <pre>{{ JSON.stringify(disableResult, null, 2) }}</pre>
      </div>

      <div v-if="lastError" class="result-block error-block">
        <h4>最近错误</h4>
        <pre>{{ JSON.stringify(lastError, null, 2) }}</pre>
      </div>
    </section>

    <section class="card">
      <h3>调用日志</h3>
      <ul class="log-list">
        <li v-for="log in logs" :key="log">{{ log }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.admin-demo {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-header {
  text-align: center;
}

.subtitle {
  color: #666;
  margin-top: 0.5rem;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}

.card h3 {
  margin-bottom: 1rem;
}

.grid {
  display: grid;
  gap: 1rem;
  margin-bottom: 1rem;
}

.two-columns {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.three-columns {
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.four-columns {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.single-column {
  grid-template-columns: 1fr;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field span {
  font-weight: 600;
  color: #333;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: inherit;
}

.field textarea {
  resize: vertical;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.full-width {
  grid-column: 1 / -1;
}

.primary-button,
.secondary-button,
.danger-button {
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.25rem;
  cursor: pointer;
  font-weight: 600;
}

.primary-button {
  background: #1677ff;
  color: #fff;
}

.secondary-button {
  background: #f3f4f6;
  color: #333;
}

.danger-button {
  background: #dc2626;
  color: #fff;
}

.primary-button:disabled,
.secondary-button:disabled,
.danger-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status {
  margin-bottom: 1rem;
  color: #333;
}

.result-block {
  margin-top: 1rem;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.result-block pre {
  background: #0f172a;
  color: #e2e8f0;
  padding: 1rem;
  border-radius: 8px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.error-block pre {
  background: #450a0a;
}

.log-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 240px;
  overflow: auto;
}

.log-list li {
  background: #f8fafc;
  border-radius: 8px;
  padding: 0.75rem;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.9rem;
}
</style>
