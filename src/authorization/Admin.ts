import {
  queryAdminMerchantList as queryAdminMerchantListApi,
  createMerchant as createMerchantApi,
  updateMerchant as updateMerchantApi,
  disableMerchant as disableMerchantApi,
} from '../service/api/admin';
import type { ApiRequestConfig, ApiResponse } from '../types';
import { SDKError } from '../types';
import { signAdminToken } from './appAdminTokenTool';

type AdminApiPayload<T> = {
  code: number;
  data: T;
  message: string;
};

type MerchantItem = {
  id: number;
  appId: string;
  appSecret: string;
  siteId: string;
  domain: string;
  name: string;
  logo: string;
  status: number;
  createdAt?: string;
  updatedAt?: string;
};

type QueryMerchantListParams = {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: number;
};

type QueryMerchantListResult = {
  rows: MerchantItem[];
  total: number;
  page: number;
  pageSize: number;
};

type CreateMerchantParams = {
  domain: string;
  name: string;
  logo?: string;
  status: number;
};

type UpdateMerchantParams = {
  id: number;
  domain?: string;
  name?: string;
  logo?: string;
  status?: number;
};

type DisableMerchantResult = boolean;

/**
 * 管理员角色，提供商户管理相关的 CRUD 操作
 */
export class Admin {
  private jwtSecret?: string;
  private jwtTtlSec = 300;

  /**
   * 配置 JWT 鉴权。调用后每次 API 请求自动生成 admin JWT 并附加到 Authorization header。
   * @param secret - 与服务端共享的 JWT 签名密钥
   * @param ttlSec - JWT 有效秒数，默认 300
   */
  setAuth(secret: string, ttlSec = 300): void {
    this.jwtSecret = secret;
    this.jwtTtlSec = ttlSec;
  }

  /** 如果已配置 JWT secret，则生成新 token 并合并到请求头的 Authorization 字段 */
  private async applyAuthHeader(config?: ApiRequestConfig): Promise<ApiRequestConfig> {
    if (!this.jwtSecret) return config || {};

    const { token } = await signAdminToken({ secret: this.jwtSecret, ttlSec: this.jwtTtlSec });

    console.log('debug token', token);
    return {
      ...(config || {}),
      headers: {
        ...(config?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    };
  }

  private getErrorCode(code: number): string {
    switch (code) {
      case 1:
        return 'ADMIN_BUSINESS_ERROR';
      case 400:
        return 'ADMIN_INVALID_PARAMETER';
      case 401:
        return 'ADMIN_UNAUTHORIZED';
      case 403:
        return 'ADMIN_FORBIDDEN';
      case 404:
        return 'ADMIN_RESOURCE_NOT_FOUND';
      case 500:
        return 'ADMIN_SERVER_ERROR';
      default:
        return 'ADMIN_API_ERROR';
    }
  }

  private unwrapResponse<T>(result: ApiResponse<AdminApiPayload<T>>, action: string): T {
    if (!result.success) {
      throw new SDKError(
        `${action} failed: ${result.error.message || 'HTTP request failed'}`,
        'ADMIN_API_REQUEST_ERROR',
        {
          action,
          status: result.status,
          error: result.error,
        }
      );
    }

    if (result.data.code !== 0) {
      throw new SDKError(
        result.data.message || `${action} failed`,
        this.getErrorCode(result.data.code),
        {
          action,
          code: result.data.code,
          data: result.data.data,
        }
      );
    }

    return result.data.data;
  }

  /**
   * 查询商户列表
   * @param data 查询参数，包括分页、关键字和状态
   * @param config 可选的请求配置
   */
  async queryMerchantList(
    data: QueryMerchantListParams,
    config?: ApiRequestConfig
  ): Promise<QueryMerchantListResult> {
    const authConfig = await this.applyAuthHeader(config);
    const result = await queryAdminMerchantListApi(data, authConfig);
    return this.unwrapResponse(result, 'Query merchant list');
  }

  /**
   * 创建新商户
   * @param data 商户信息，包括域名、名称、Logo 和状态
   * @param config 可选的请求配置
   */
  async createMerchant(
    data: CreateMerchantParams,
    config?: ApiRequestConfig
  ): Promise<MerchantItem> {
    const authConfig = await this.applyAuthHeader(config);
    const result = await createMerchantApi(data, authConfig);
    return this.unwrapResponse(result, 'Create merchant');
  }

  /**
   * 更新商户信息
   * @param data 需要更新的商户信息，ID 为必填
   * @param config 可选的请求配置
   */
  async updateMerchant(
    data: UpdateMerchantParams,
    config?: ApiRequestConfig
  ): Promise<MerchantItem> {
    const authConfig = await this.applyAuthHeader(config);
    const result = await updateMerchantApi(data, authConfig);
    return this.unwrapResponse(result, 'Update merchant');
  }

  /**
   * 停用商户
   * @param id 商户 ID
   * @param config 可选的请求配置
   */
  async disableMerchant(id: number, config?: ApiRequestConfig): Promise<DisableMerchantResult> {
    const authConfig = await this.applyAuthHeader(config);
    const result = await disableMerchantApi({ id }, authConfig);
    return this.unwrapResponse(result, 'Disable merchant');
  }
}
