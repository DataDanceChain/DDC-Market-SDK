<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  Merchant,
  httpService,
  getKeyHash,
  getProvider,
  getSigner,
  getAddress,
} from '@ddcmarket/sdk';
import type { MerchantParams } from '@ddcmarket/sdk';

// ---- Init 配置 ----
const baseURL = ref('https://dev-mkt-engine.datadance.co/api/v1/');
// 测试商户
const appId = ref('app_fgnavuzlw3ncezza');
const merchantSecret = ref('ff7ca44626cc29b4271c76d9ac7b1fe3828df6310603707d11bce0e919832426');
// WARNING
const walletAddress = ref('0x59dcc2997875272F7e3E9cfb3Da7DbAcd0948f85');
const privateKey = ref('f28803c57022b5b83585498b8b45c26eef984aaf9e50ac16131c0fdd4913b509');

// TestNet Contract
// WARNING :固定jwt 签发 secret
const appSecret = ref('f6b9507af95a30985736eb1824b7255cb506fb7a345de5f326dd7aa439879d9d');

// ---- Chain Auth ----
const authDuration = ref(360); // 设置用户授权多久时间 (s)

// ---- User Hash ----
const userHash = ref('');
const hashPage = ref(0);
const hashPageSize = ref(10);

// ---- Token List ----
const nftAddress = ref('0x2b1995528b34c580813cfa05365b5b0f3a16e4cd');
const nftPageNo = ref(0);
const tokenId = ref('');

// ---- App APIs ----
const merchantPage = ref(0);
const merchantPageSize = ref(10);

// ---- State ----
const loading = ref(false);
const statusMessage = ref('请填写配置后初始化 Merchant，然后测试各功能。');
const lastResult = ref<unknown>(null);
const lastError = ref<unknown>(null);
const merchantInstance = ref<Merchant | null>(null);

// ---- Merchant Info ----
const merchantInfo = ref<{
  appId: string;
  siteId: string;
  siteName: string;
  domain: string;
  logo: string;
  status: string;
  contractAddress: string;
} | null>(null);

// ---- Results ----
const authResult = ref<unknown>(null);
const revokeResult = ref<unknown>(null);
const isAuthorizedResult = ref<boolean | null>(null);
const userAuthInfo = ref<unknown>(null);
const hashResult = ref<boolean | null | Object>(null);
const tokenListResult = ref<unknown>(null);
const appMerchantsResult = ref<unknown>(null);
const appAuthorizedResult = ref<unknown>(null);

let inst: Merchant | null = null;

function setStatus(msg: string, isError = false) {
  statusMessage.value = msg;
  if (isError) {
    lastError.value = msg;
  }
}

// ---- Init ----
async function handleInit() {
  loading.value = true;
  setStatus('Initializing...');

  try {
    httpService.setBaseURL(baseURL.value);

    const provider = getProvider(window.ethereum);

    const config: MerchantParams = {
      appId: appId.value,
      provider,
      walletAddress: walletAddress.value,
      debug: true,
    };

    inst = await Merchant.init(config);
    merchantInstance.value = inst;

    merchantInfo.value = {
      appId: (inst as any).merchantInfo?.appId || '',
      siteId: (inst as any).merchantInfo?.siteId || '',
      siteName: (inst as any).merchantInfo?.siteName || '',
      domain: (inst as any).merchantInfo?.domain || '',
      logo: (inst as any).merchantInfo?.logo || '',
      status: (inst as any).merchantInfo?.status || '',
      contractAddress: (inst as any).merchantInfo?.authorization_contract_address || '',
    };

    lastResult.value = merchantInfo.value;
    setStatus('Merchant initialized successfully.');
  } catch (e: any) {
    setStatus(`Init failed: ${e.message}`, true);
  } finally {
    loading.value = false;
  }
}

// ---- Chain Authorization ----
async function handleUserAuth() {
  if (!inst) {
    setStatus('Please init first.', true);
    return;
  }
  loading.value = true;
  setStatus('Authorizing...');
  try {
    authResult.value = await inst.userAuth(authDuration.value);
    lastResult.value = authResult.value;
    setStatus(`Authorization successful. ${authResult.value}`);
  } catch (e: any) {
    setStatus(`Authorization failed: ${e.message}`, true);
  } finally {
    loading.value = false;
  }
}

async function handleRevokeUserAuth() {
  if (!inst) {
    setStatus('Please init first.', true);
    return;
  }
  loading.value = true;
  setStatus('Revoking...');
  try {
    revokeResult.value = await inst.revokeUserAuth();
    lastResult.value = revokeResult.value;
    setStatus('Revoke successful.');
  } catch (e: any) {
    setStatus(`Revoke failed: ${e.message}`, true);
  } finally {
    loading.value = false;
  }
}

async function handleIsUserAuthorized() {
  if (!inst) {
    setStatus('Please init first.', true);
    return;
  }
  loading.value = true;
  setStatus('Checking authorization...');
  try {
    isAuthorizedResult.value = await inst.isUserAuthorized();
    lastResult.value = isAuthorizedResult.value;
    setStatus(`Authorized: ${isAuthorizedResult.value}`);
  } catch (e: any) {
    setStatus(`Check failed: ${e.message}`, true);
  } finally {
    loading.value = false;
  }
}

async function handleGetUserAuthorization() {
  if (!inst) {
    setStatus('Please init first.', true);
    return;
  }
  loading.value = true;
  setStatus('Querying authorization info...');
  try {
    userAuthInfo.value = await inst.getUserAuthorization();
    lastResult.value = userAuthInfo.value;
    setStatus('Authorization info retrieved.');
  } catch (e: any) {
    setStatus(`Query failed: ${e.message}`, true);
  } finally {
    loading.value = false;
  }
}

// ---- User Hash ----

async function getMyHash() {
  userHash.value = getKeyHash(privateKey.value);
  console.log('the wallet address hash key is', userHash.value);
  return;
}

async function handleBindUserHash() {
  if (!inst) {
    setStatus('Please init first.', true);
    return;
  }
  loading.value = true;
  setStatus('Binding user hash...');
  try {
    hashResult.value = await inst.bindUserHash(
      userHash.value,
      walletAddress.value,
      appSecret.value
    );
    lastResult.value = hashResult.value;
    setStatus(`Hash bind: ${hashResult.value}`);
  } catch (e: any) {
    setStatus(`Hash bind failed: ${e.message}`, true);
  } finally {
    loading.value = false;
  }
}

async function handleUnbindUserHash() {
  if (!inst) {
    setStatus('Please init first.', true);
    return;
  }
  loading.value = true;
  setStatus('UnBinding user hash...');
  try {
    hashResult.value = await inst.unbindUserHash(
      userHash.value,
      walletAddress.value,
      appSecret.value
    );
    lastResult.value = hashResult.value;
    setStatus(`Hash unbind: ${hashResult.value}`);
  } catch (e: any) {
    setStatus(`Hash unbind failed: ${e.message}`, true);
  } finally {
    loading.value = false;
  }
}

async function handleQueryUserHashList() {
  if (!inst) {
    setStatus('Please init first.', true);
    return;
  }
  loading.value = true;
  setStatus('UnBinding user hash...');
  try {
    hashResult.value = await inst.queryUserHashList(
      {
        page: hashPage.value,
        pageSize: hashPageSize.value,
      },
      walletAddress.value,
      appSecret.value
    );
    lastResult.value = hashResult.value;
    setStatus(`Hash unbind: ${hashResult.value}`);
  } catch (e: any) {
    setStatus(`Hash unbind failed: ${e.message}`, true);
  } finally {
    loading.value = false;
  }
}

// ---- Token List ----
// TODO
async function handleQueryTokenList() {
  if (!inst) {
    setStatus('Please init first.', true);
    return;
  }
  loading.value = true;
  setStatus('Querying token list...');
  try {
    tokenListResult.value = await inst.queryTokenList(
      merchantSecret.value,
      walletAddress.value,
      nftPageNo.value
    );
    lastResult.value = tokenListResult.value;
    setStatus('Token list retrieved.');
  } catch (e: any) {
    setStatus(`Token list query failed: ${e.message}`, true);
  } finally {
    loading.value = false;
  }
}

async function handleQueryNftTokenDetail() {
  if (!inst) {
    setStatus('Please init first.', true);
    return;
  }
  loading.value = true;
  setStatus('Querying token list...');
  try {
    tokenListResult.value = await inst.queryNftTokenDetail(
      merchantSecret.value,
      walletAddress.value,
      nftAddress.value,
      tokenId.value
    );
    lastResult.value = tokenListResult.value;
    setStatus('Token list retrieved.');
  } catch (e: any) {
    setStatus(`Token list query failed: ${e.message}`, true);
  } finally {
    loading.value = false;
  }
}

// ---- App APIs ----
// 用户接口查询可授权商户列表
async function handleQueryAppMerchants() {
  if (!inst) {
    setStatus('Please init first.', true);
    return;
  }
  loading.value = true;
  setStatus('Querying app merchants...');
  try {
    appMerchantsResult.value = await inst.queryAppMechants(
      walletAddress.value,
      appSecret.value,
      merchantPage.value,
      merchantPageSize.value
    );
    lastResult.value = appMerchantsResult.value;
    setStatus('App merchants retrieved.');
  } catch (e: any) {
    setStatus(`App merchants query failed: ${e.message}`, true);
  } finally {
    loading.value = false;
  }
}
// 用户接口查询有效授权商户列表
async function handleQueryAppAuthorizedMerchants() {
  if (!inst) {
    setStatus('Please init first.', true);
    return;
  }
  loading.value = true;
  setStatus('Querying authorized merchants...');
  try {
    appAuthorizedResult.value = await inst.queryAppAuthorizedMechants(
      walletAddress.value,
      appSecret.value,
      merchantPage.value,
      merchantPageSize.value
    );
    lastResult.value = appAuthorizedResult.value;
    setStatus('Authorized merchants retrieved.');
  } catch (e: any) {
    setStatus(`Authorized merchants query failed: ${e.message}`, true);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  setTimeout(() => {
    handleInit();
  }, 1000);
});
</script>

<template>
  <div class="merchant-demo">
    <!-- Status -->
    <div class="status-bar" :class="{ error: lastError }">
      <span class="status-icon">{{ lastError ? '❌' : 'ℹ️' }}</span>
      <span>{{ statusMessage }}</span>
    </div>

    <!-- Section 1: Init -->
    <section class="demo-section">
      <h2>1. 初始化 Merchant</h2>
      <div class="form-grid">
        <div class="form-item">
          <label>Base URL</label>
          <input v-model="baseURL" placeholder="http://localhost:3000" />
        </div>
        <div class="form-item">
          <label>App ID</label>
          <input v-model="appId" placeholder="app_xxx" />
        </div>
        <div class="form-item">
          <label>Wallet Address</label>
          <input v-model="walletAddress" placeholder="0x..." />
        </div>
        <div class="form-item">
          <label>Private Key</label>
          <input v-model="privateKey" type="password" placeholder="hex private key" />
        </div>
        <div class="form-item">
          <label>Authorization Contract Address (optional)</label>
          <label>{{ merchantInfo?.contractAddress }}</label>
        </div>
      </div>
      <button class="btn btn-primary" :disabled="loading" @click="handleInit">
        {{ loading ? 'Initializing...' : 'Initialize' }}
      </button>

      <div v-if="merchantInfo?.appId" class="info-box">
        <p><strong>App ID:</strong> {{ merchantInfo.appId }}</p>
        <p><strong>Site ID:</strong> {{ merchantInfo.siteId }}</p>
        <p><strong>Site Name:</strong> {{ merchantInfo.siteName }}</p>
        <p><strong>Domain:</strong> {{ merchantInfo.domain }}</p>
        <p><strong>Logo:</strong> {{ merchantInfo.logo }}</p>
      </div>
    </section>

    <!-- Section 2: Chain Authorization -->
    <section class="demo-section">
      <h2>2. 链上授权</h2>
      <div class="form-grid">
        <div class="form-item">
          <label>Duration (seconds)</label>
          <input v-model.number="authDuration" type="number" placeholder="3600" />
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-success" :disabled="loading" @click="handleUserAuth">
          userAuth
        </button>
        <button class="btn btn-danger" :disabled="loading" @click="handleRevokeUserAuth">
          revokeUserAuth
        </button>
        <button class="btn btn-info" :disabled="loading" @click="handleIsUserAuthorized">
          isUserAuthorized
        </button>
        <button class="btn btn-info" :disabled="loading" @click="handleGetUserAuthorization">
          getUserAuthorization
        </button>
      </div>

      <div v-if="authResult" class="info-box">
        <p><strong>Auth Result:</strong></p>
        <pre>{{ authResult }}</pre>
      </div>
      <div v-if="revokeResult" class="info-box">
        <p><strong>Revoke Result:</strong></p>
        <pre>{{ revokeResult }}</pre>
      </div>
      <div v-if="isAuthorizedResult !== null" class="info-box">
        <p><strong>Is Authorized:</strong> {{ isAuthorizedResult }}</p>
      </div>
      <div v-if="userAuthInfo" class="info-box">
        <p><strong>Authorization Info:</strong></p>
        <pre>{{ userAuthInfo }}</pre>
      </div>
    </section>

    <!-- Section 3: User Hash -->
    <section class="demo-section">
      <h2>3. 用户 Hash 绑定</h2>
      <div class="form-grid">
        <div class="form-item">
          <label>User Hash</label>
          <input v-model="userHash" placeholder="hash value" />
        </div>
        <div class="form-item">
          <label>Wallet Address</label>
          <input v-model="walletAddress" placeholder="0x..." />
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-success" :disabled="loading" @click="getMyHash">getKeyHash</button>

        <button class="btn btn-primary" :disabled="loading" @click="handleBindUserHash">
          bindUserHash
        </button>

        <button class="btn btn-primary" :disabled="loading" @click="handleUnbindUserHash">
          UnbindUserHash
        </button>

        <button class="btn btn-primary" :disabled="loading" @click="handleQueryUserHashList">
          Queyr User Hash List
        </button>
      </div>
      <div v-if="hashResult !== null" class="info-box">
        <p><strong>Hash Bind Result:</strong> {{ hashResult }}</p>
      </div>
    </section>

    <!-- Section 4: Token List & App APIs -->
    <section class="demo-section">
      <h2>4. Token List & App APIs</h2>
      <div class="form-grid">
        <div class="form-item">
          <label>App Secret</label>
          <input v-model="appSecret" placeholder="hex secret" />
        </div>
        <div class="form-item">
          <label>NFT Address (for token list)</label>
          <input v-model="nftAddress" placeholder="0x..." />
        </div>
        <div class="form-item">
          <label>NFT Page No</label>
          <input v-model.number="nftPageNo" type="number" placeholder="0" />
        </div>
        <div class="form-item">
          <label>Merchant Page</label>
          <input v-model.number="merchantPage" type="number" placeholder="0" />
        </div>
        <div class="form-item">
          <label>Merchant Page Size</label>
          <input v-model.number="merchantPageSize" type="number" placeholder="10" />
        </div>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" :disabled="loading" @click="handleQueryTokenList">
          queryTokenList
        </button>
      </div>
      <div class="form-item">
        <label>Token Id</label>
        <input v-model="tokenId" type="number" placeholder="10" />
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" :disabled="loading" @click="handleQueryNftTokenDetail">
          queryNftTokenDetail
        </button>
      </div>

      <div v-if="tokenListResult" class="info-box">
        <p><strong>Token List:</strong></p>
        <pre>{{ tokenListResult }}</pre>
      </div>
      <div v-if="appMerchantsResult" class="info-box">
        <p><strong>App Merchants:</strong></p>
        <pre>{{ appMerchantsResult }}</pre>
      </div>
      <div v-if="appAuthorizedResult" class="info-box">
        <p><strong>Authorized Merchants:</strong></p>
        <pre>{{ appAuthorizedResult }}</pre>
      </div>
    </section>

    <section class="demo-section">
      <h2>App 钱包开放功能</h2>
      <div class="btn-row">
        <button class="btn btn-primary" :disabled="loading" @click="handleQueryAppMerchants">
          queryAppMechants (用户接口查询可授权商户列表)
        </button>
        <button
          class="btn btn-primary"
          :disabled="loading"
          @click="handleQueryAppAuthorizedMerchants"
        >
          queryAppAuthorizedMechants (用户接口查询当前有效授权列表)
        </button>
      </div>
    </section>

    <!-- Last Result -->
    <section class="demo-section" v-if="lastResult">
      <h2>Last Result</h2>
      <pre class="result-pre">{{ lastResult }}</pre>
    </section>
  </div>
</template>

<style scoped>
.merchant-demo {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #e8f4fd;
  border: 1px solid #1677ff;
  border-radius: 8px;
  font-size: 0.95rem;
}
.status-bar.error {
  background: #fff0f0;
  border-color: #e74c3c;
}
.status-icon {
  font-size: 1.2rem;
}

.demo-section {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  padding: 1.5rem;
}
.demo-section h2 {
  margin: 0 0 1rem;
  font-size: 1.15rem;
  color: #333;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 0.5rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.form-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.form-item label {
  font-size: 0.85rem;
  color: #666;
  font-weight: 600;
}
.form-item input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
}

.btn {
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-primary {
  background: #1677ff;
  color: #fff;
}
.btn-primary:hover:not(:disabled) {
  background: #0f5edb;
}
.btn-success {
  background: #28a745;
  color: #fff;
}
.btn-success:hover:not(:disabled) {
  background: #218838;
}
.btn-danger {
  background: #e74c3c;
  color: #fff;
}
.btn-danger:hover:not(:disabled) {
  background: #c0392b;
}
.btn-info {
  background: #17a2b8;
  color: #fff;
}
.btn-info:hover:not(:disabled) {
  background: #138496;
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.info-box {
  margin-top: 1rem;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
}
.info-box p {
  margin: 0.25rem 0;
}
.info-box pre {
  margin: 0.5rem 0 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 0.8rem;
  color: #333;
  max-height: 200px;
  overflow-y: auto;
}

.result-pre {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
}
</style>
