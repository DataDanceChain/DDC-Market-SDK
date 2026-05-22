import { requestPost } from '../index';
import type { ApiResponse, ApiRequestConfig } from '../../types';

// response code 含义

// - 0：成功
// - 1：业务失败
// - 400：参数错误
// - 401：未登录、签名错误、token 错误、token 过期
// - 403：禁止访问、未授权、商户被禁用
// - 404：资源不存在
// - 500：系统错误

/**
 * queryAdminMerchantList
 * 管理员查询商户列表
 * @path POST /app/admin/merchants/list
 */
export async function queryAdminMerchantList(
  data: {
    /** 页码，从 0 开始，默认 0 */
    page: number;
    /** 每页条数，默认 10，最大 20 */
    pageSize: number;
    /** 可选，按 domain / name / appId / siteId 模糊搜索 */
    keyword?: string;
    /** 可选，0 或 1 */
    status?: number;
  },
  config?: ApiRequestConfig
): Promise<
  ApiResponse<{
    code: number;
    data: {
      rows: Array<{
        id: number;
        appId: string;
        appSecret: string;
        siteId: string;
        domain: string;
        name: string;
        logo: string;
        status: number;
        createdAt: string;
        updatedAt: string;
      }>;
      total: number;
      page: number;
      pageSize: number;
    };
    message: string;
  }>
> {
  return requestPost<{
    code: number;
    data: {
      rows: Array<{
        id: number;
        appId: string;
        appSecret: string;
        siteId: string;
        domain: string;
        name: string;
        logo: string;
        status: number;
        createdAt: string;
        updatedAt: string;
      }>;
      total: number;
      page: number;
      pageSize: number;
    };
    message: string;
  }>(`/app/admin/merchants/list`, data, config);
}

/**
 * createMerchant
 * 管理员新增商户
 * @path POST /app/admin/merchants
 */
export async function createMerchant(
  data: {
    /** 商户域名，必填 */
    domain: string;
    /** 商户名称，必填 */
    name: string;
    /** 商户 logo，可选，默认空字符串 */
    logo?: string;
    /** 商户状态，0/1，默认 1 */
    status: number;
  },
  config?: ApiRequestConfig
): Promise<
  ApiResponse<{
    code: number;
    data: {
      id: number;
      appId: string;
      appSecret: string;
      siteId: string;
      domain: string;
      name: string;
      logo: string;
      status: number;
    };
    message: string;
  }>
> {
  return requestPost<{
    code: number;
    data: {
      id: number;
      appId: string;
      appSecret: string;
      siteId: string;
      domain: string;
      name: string;
      logo: string;
      status: number;
    };
    message: string;
  }>(`/app/admin/merchants`, data, config);
}

/**
 * updateMerchant
 * 管理员更新商户
 * @path POST /app/admin/merchants/update
 */
export async function updateMerchant(
  data: {
    /** 商户主键，必填 */
    id: number;
    /** 商户域名，可选 */
    domain?: string;
    /** 商户名称，可选 */
    name?: string;
    /** 商户 logo，可选 */
    logo?: string;
    /** 商户状态，0/1，可选 */
    status?: number;
  },
  config?: ApiRequestConfig
): Promise<
  ApiResponse<{
    code: number;
    data: {
      id: number;
      appId: string;
      appSecret: string;
      siteId: string;
      domain: string;
      name: string;
      logo: string;
      status: number;
    };
    message: string;
  }>
> {
  return requestPost<{
    code: number;
    data: {
      id: number;
      appId: string;
      appSecret: string;
      siteId: string;
      domain: string;
      name: string;
      logo: string;
      status: number;
    };
    message: string;
  }>(`/app/admin/merchants/update`, data, config);
}

/**
 * disableMerchant
 * 管理员停用商户
 * @path POST /app/admin/merchants/disable
 */
export async function disableMerchant(
  data: {
    /** 商户主键 */
    id: number;
  },
  config?: ApiRequestConfig
): Promise<
  ApiResponse<{
    code: number;
    data: boolean;
    message: string;
  }>
> {
  return requestPost<{
    code: number;
    data: boolean;
    message: string;
  }>(`/app/admin/merchants/disable`, data, config);
}
