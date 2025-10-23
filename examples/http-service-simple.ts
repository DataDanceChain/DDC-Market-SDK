/**
 * HTTP Service 简洁使用示例
 *
 * 展示统一响应类型的优势和单例模式的使用
 */

import { requestGet, requestPost, requestPut, requestDelete, httpService } from '../src/service';
import type { ApiResponse } from '../src/types';

// ============================================================================
// 类型定义
// ============================================================================

interface User {
  id: string;
  name: string;
  email: string;
}

interface NFT {
  tokenId: string;
  owner: string;
  name: string;
  metadata: string;
}

// ============================================================================
// 示例 1: 统一的响应类型 - 类型安全的判别联合
// ============================================================================

/**
 * 使用新的统一响应类型
 * - response.success 作为类型守卫
 * - TypeScript 自动推断 data 和 error 的类型
 */
async function fetchUserExample() {
  const response = await requestGet<User>('/api/users/123');

  // TypeScript 通过 response.success 自动推断类型
  if (response.success) {
    // 这里 response.data 的类型是 User（不是 null）
    console.log('User name:', response.data.name);
    console.log('Status code:', response.status);
    // response.error; // ❌ TypeScript 错误：error 在 success 分支中是 null
  } else {
    // 这里 response.error 的类型是 AxiosError（不是 null）
    console.error('Error message:', response.error.message);
    console.error('HTTP status:', response.status); // number | null
    // response.data; // ❌ TypeScript 错误：data 在 error 分支中是 null
  }
}

// ============================================================================
// 示例 2: 简洁的错误处理
// ============================================================================

/**
 * 简化的错误处理 - 不需要检查 data 和 err 两个字段
 */
async function createUserExample() {
  const response = await requestPost<User>('/api/users', {
    name: 'Alice',
    email: 'alice@example.com',
  });

  // 一个字段判断成功或失败
  if (response.success) {
    return response.data; // 返回 User
  }

  // 统一的错误处理
  console.error('Failed to create user:', response.error.message);
  return null;
}

// ============================================================================
// 示例 3: 使用单例 httpService 配置全局设置
// ============================================================================

/**
 * 配置全局 baseURL 和 headers
 * 所有通过 httpService 的请求都会使用这些配置
 */
function configureHttpService() {
  // 设置 API 基础 URL
  httpService.setBaseURL('https://api.example.com');

  // 设置全局 headers（如认证 token）
  httpService.setHeaders({
    Authorization: 'Bearer your-access-token',
    'X-Client-Version': '1.0.0',
  });
}

/**
 * 使用配置好的 httpService
 */
async function useConfiguredService() {
  // 配置一次
  configureHttpService();

  // 所有后续请求都会使用配置的 baseURL 和 headers
  const user = await requestGet<User>('/users/me'); // 完整 URL: https://api.example.com/users/me
  const nfts = await requestGet<NFT[]>('/nfts/my-tokens');

  if (user.success) {
    console.log('Current user:', user.data.name);
  }

  if (nfts.success) {
    console.log('NFT count:', nfts.data.length);
  }
}

// ============================================================================
// 示例 4: 类型安全的数据访问
// ============================================================================

/**
 * 展示类型推断的强大之处
 */
async function typeSafetyExample() {
  const response = await requestGet<User>('/api/users/123');

  if (response.success) {
    // ✅ TypeScript 知道这些属性存在
    const name: string = response.data.name;
    const email: string = response.data.email;

    // ❌ TypeScript 编译错误：User 没有 age 属性
    // const age = response.data.age;

    // ✅ 可以直接解构
    const { name: userName, email: userEmail } = response.data;
  } else {
    // ✅ TypeScript 知道 error 是 AxiosError
    const errorMessage: string = response.error.message;
    const statusCode: number | undefined = response.error.response?.status;

    // ❌ TypeScript 编译错误：data 在这里是 null
    // const name = response.data.name;
  }
}

// ============================================================================
// 示例 5: 实战 - 完整的 CRUD 操作
// ============================================================================

class UserService {
  /**
   * 获取用户
   */
  async getUser(id: string): Promise<User | null> {
    const response = await requestGet<User>(`/api/users/${id}`);
    return response.success ? response.data : null;
  }

  /**
   * 创建用户
   */
  async createUser(data: Omit<User, 'id'>): Promise<User | null> {
    const response = await requestPost<User>('/api/users', data);

    if (response.success) {
      console.log('User created with ID:', response.data.id);
      return response.data;
    }

    // 详细的错误处理
    if (response.error.response?.status === 400) {
      console.error('Validation error:', response.error.response.data);
    } else {
      console.error('Failed to create user:', response.error.message);
    }

    return null;
  }

  /**
   * 更新用户
   */
  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const response = await requestPut<User>(`/api/users/${id}`, updates);
    return response.success ? response.data : null;
  }

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<boolean> {
    const response = await requestDelete<{ success: boolean }>(`/api/users/${id}`);
    return response.success && response.data.success;
  }

  /**
   * 搜索用户
   */
  async searchUsers(keyword: string): Promise<User[]> {
    const response = await requestGet<{ items: User[] }>('/api/users/search', {
      params: { q: keyword },
    });

    return response.success ? response.data.items : [];
  }
}

// ============================================================================
// 示例 6: 带认证的 API 调用
// ============================================================================

class AuthenticatedApi {
  private token: string | null = null;

  /**
   * 登录并保存 token
   */
  async login(email: string, password: string): Promise<boolean> {
    const response = await requestPost<{ token: string; user: User }>('/api/auth/login', {
      email,
      password,
    });

    if (response.success) {
      this.token = response.data.token;
      // 设置全局 Authorization header
      httpService.setHeaders({
        Authorization: `Bearer ${this.token}`,
      });
      return true;
    }

    console.error('Login failed:', response.error.message);
    return false;
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<User | null> {
    if (!this.token) {
      console.error('Not authenticated');
      return null;
    }

    const response = await requestGet<User>('/api/users/me');
    return response.success ? response.data : null;
  }

  /**
   * 登出
   */
  logout(): void {
    this.token = null;
    httpService.setHeaders({ Authorization: '' });
  }
}

// ============================================================================
// 示例 7: 高级错误处理
// ============================================================================

/**
 * 统一的错误处理函数
 */
function handleApiError(response: ApiResponse<any>): string {
  if (response.success) {
    return '';
  }

  const { error, status } = response;

  // 根据状态码返回友好的错误消息
  switch (status) {
    case 400:
      return '请求参数错误';
    case 401:
      return '请先登录';
    case 403:
      return '没有权限';
    case 404:
      return '资源不存在';
    case 500:
      return '服务器错误';
    default:
      return error.message || '请求失败';
  }
}

/**
 * 使用统一错误处理
 */
async function fetchUserWithErrorHandling(id: string) {
  const response = await requestGet<User>(`/api/users/${id}`);

  if (response.success) {
    return response.data;
  }

  // 使用统一的错误处理
  const errorMessage = handleApiError(response);
  console.error(errorMessage);
  return null;
}

// ============================================================================
// 示例 8: 带重试的请求
// ============================================================================

/**
 * 自动重试失败的请求（仅对网络错误或 5xx 错误重试）
 */
async function requestWithRetry<T>(
  request: () => Promise<ApiResponse<T>>,
  maxRetries: number = 3
): Promise<ApiResponse<T>> {
  let lastResponse: ApiResponse<T> | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await request();

    if (response.success) {
      return response;
    }

    lastResponse = response;

    // 不重试客户端错误（4xx）
    if (response.status && response.status >= 400 && response.status < 500) {
      break;
    }

    // 最后一次尝试，不等待
    if (attempt < maxRetries - 1) {
      const delay = 1000 * Math.pow(2, attempt); // 指数退避
      await new Promise((resolve) => setTimeout(resolve, delay));
      console.log(`Retrying... (${attempt + 1}/${maxRetries})`);
    }
  }

  return lastResponse!;
}

/**
 * 使用重试机制
 */
async function fetchWithRetryExample() {
  const response = await requestWithRetry(() => requestGet<User>('/api/users/123'), 3);

  if (response.success) {
    console.log('User:', response.data.name);
  } else {
    console.error('Failed after retries:', response.error.message);
  }
}

// ============================================================================
// 使用总结
// ============================================================================

async function mainExample() {
  // 1. 配置全局设置（只需一次）
  httpService.setBaseURL('https://api.example.com');
  httpService.setHeaders({
    'X-Client-Name': 'DDC-Market-SDK',
  });

  // 2. 使用便捷函数发起请求
  const userResponse = await requestGet<User>('/users/123');

  // 3. 统一的类型安全响应处理
  if (userResponse.success) {
    console.log('✅ Success:', userResponse.data.name);
    console.log('   Status:', userResponse.status);
  } else {
    console.log('❌ Error:', userResponse.error.message);
    console.log('   Status:', userResponse.status);
  }

  // 4. 使用服务类
  const userService = new UserService();
  const user = await userService.getUser('123');
  if (user) {
    console.log('Found user:', user.name);
  }

  // 5. 带认证的 API
  const authApi = new AuthenticatedApi();
  const loggedIn = await authApi.login('user@example.com', 'password');
  if (loggedIn) {
    const currentUser = await authApi.getCurrentUser();
    console.log('Current user:', currentUser?.name);
  }
}

// 导出示例
export {
  fetchUserExample,
  createUserExample,
  configureHttpService,
  useConfiguredService,
  typeSafetyExample,
  UserService,
  AuthenticatedApi,
  handleApiError,
  requestWithRetry,
  mainExample,
};
