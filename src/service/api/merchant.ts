import { requestGet, requestPost } from '../index';
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
 * queryMerchantInfo
 * 获取商户信息
 * @path GET /merchant/info
 */
export async function queryMerchantInfo(
  appId: string,
  config?: ApiRequestConfig
): Promise<
  ApiResponse<{
    code: number;
    data: {
      appId: string;
      siteId: string;
      domain: string;
      name: string;
      logo: string;
    };
    message: string; // 'ok'
  }>
> {
  return requestGet<{
    code: number;
    data: {
      appId: string;
      siteId: string;
      domain: string;
      name: string;
      logo: string;
    };
    message: string;
  }>(`/merchant/info?appId=${appId}`, config);
}

/**
 * getToken
 * 商户换 token
 * @path POST /auth/merchant/token
 */
export async function getToken(
  data: {
    /** 商户 id */
    appId: string;

    /** 时间戳 秒 */
    timestamp: string; // "1778856710",

    /** nonce 秒 */
    nonce: string; // "566acea13b6fa8eeb520b946",

    /** 签名 */
    sign: string; // "cdc36e156e872e29b9651841f7da192c39ce8ceef2395ed704c5842ce8f3af6a"
  },
  config?: ApiRequestConfig
): Promise<
  ApiResponse<{
    code: number;
    data: {
      accessToken: string; // eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhcHBfZmduYXZ1emx3M25jZXp6YSIsImp0aSI6IjN5WGFOX0t6MWdGaXU4NjUiLCJhY3RvclR5cGUiOiJtZXJjaGFudCIsImFwcElkIjoiYXBwX2ZnbmF2dXpsdzNuY2V6emEiLCJzaXRlSWQiOiIweGZhZTgxZDYxNjdlODNjYjNmZTc5ZTA5NDUxNDMxZjJmMDNjM2U3M2FkZmYyNjlkYzQ2MmJkZGE0MTM5OWEzZTEiLCJpYXQiOjE3NzkwOTA3NDIsImV4cCI6MTc3OTA5Nzk0MiwiaXNzIjoiZGRjLW1hcmtldC1lbmdpbmUiLCJhdWQiOiJkZGMtbWFya2V0LXNkayJ9.rAxQpI8mIs0pYMUeH_VGjcXaygLzmfczFNzoyWGQIYE
      expireIn: string; // 7200
      expiresAt: string; // "2026-05-18T09:52:22.000Z"
    } | null;
    message: string; // 'ok'
  }>
> {
  return requestPost<{
    code: number;
    data: {
      accessToken: string;
      expireIn: string;
      expiresAt: string;
    } | null;
    message: string;
  }>(`/auth/merchant/token`, data, config);
}

// response code 含义

// - 0：成功
// - 1：业务失败
// - 400：参数错误
// - 401：未登录、签名错误、token 错误、token 过期
// - 403：禁止访问、未授权、商户被禁用
// - 404：资源不存在
// - 500：系统错误

/**
 * setUserHash
 * 钱包地址关联隐私hash
 * @path POST /user/hash
 */
export async function setUserHash(
  data: {
    /** 隐私hash */
    hash: string;
  },
  config?: ApiRequestConfig
): Promise<
  ApiResponse<{
    code: number;
    data: boolean; // true  成功   "result": false  失败;
    message: string; // 'ok'
  }>
> {
  return requestPost<{
    code: number;
    data: boolean;
    message: string;
  }>(`/user/hash`, data, config);
}

/**
 * unBindUserHash
 * 钱包地址取消关联隐私hash
 * @path POST /user/hash
 */
export async function unBindUserHash(
  data: {
    /** 隐私hash */
    hash: string;
  },
  config?: ApiRequestConfig
): Promise<
  ApiResponse<{
    code: number;
    data: boolean; // true  成功   "result": false  失败;
    message: string; // 'ok'
  }>
> {
  return requestPost<{
    code: number;
    data: boolean;
    message: string;
  }>(`/user/hash/unbind`, data, config);
}

/**
 * getUserHashList
 * 钱包地址已关联的隐私hash列表
 * @path POST /user/hashes/list
 */
export async function getUserHashList(
  page: {
    /** 页数 */
    page: number;
    /** 页码大小 */
    pageSize: number;
  },
  config?: ApiRequestConfig
): Promise<
  ApiResponse<{
    code: number;
    data: {
      page: number;
      pageSize: number;
      total: number;
      rows: Array<{
        hash: string;
        createdAt: string;
      }>;
    };
    message: string; // 'ok'
  }>
> {
  return requestPost<{
    code: number;
    data: {
      page: number;
      pageSize: number;
      total: number;
      rows: Array<{
        hash: string;
        createdAt: string;
      }>;
    };
    message: string;
  }>(`/user/hashes/list`, page, config);
}

/**
 * getNftList
 * 商户查询用户nft列表
 * @path POST /privacy/tokens/of/wallet/{wallet}
 */
export async function getNftList(
  params: {
    /** 用户地址 */
    address: string;

    /** 时间戳 秒 */
    accessToken: string;

    /** page 秒 */
    page: {
      page: number;
      pageSize: number;
    };
  },
  config?: ApiRequestConfig
): Promise<
  ApiResponse<{
    code: number;
    data: {
      Rows: Array<{
        token: string;
        tokenId: string;
        owner: string;
        name: string;
        image: string;
      }>;
    };
    message: string; // 'ok'
  }>
> {
  return requestPost<{
    code: number;
    data: {
      Rows: Array<{
        token: string;
        tokenId: string;
        owner: string;
        name: string;
        image: string;
      }>;
    };
    message: string;
  }>(`/privacy/tokens/of/wallet/${params.address}`, params.page, {
    ...config,
    baseURL: import.meta.env.API_EXPLORE_BASE_URL || '',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
  });
}

/**
 * getNftList
 * 商户查询用户单个nft详情
 * @path POST /privacy/tokens/of/wallet/{wallet}
 */
export async function getNftDetail(
  params: {
    /** 用户地址 */
    address: string;

    /** 商户token */
    accessToken: string;

    /** 合约地址 */
    contractAddress: string;

    /** token id */
    tokenId: string;
  },
  config?: ApiRequestConfig
): Promise<
  ApiResponse<{
    code: number;
    data: {
      token: string; // "0x...",
      tokenId: string; // "216",
      metadata: {
        name: string; // "",
        image: string; // ""
      };
    };
    message: string; // 'ok'
  }>
> {
  return requestPost<{
    code: number;
    data: {
      token: string; // "0x...",
      tokenId: string; // "216",
      metadata: {
        name: string; // "",
        image: string; // ""
      };
    };
    message: string;
  }>(
    `/privacy/token/of/wallet/${params.address}/${params.contractAddress}/${params.tokenId}`,
    undefined,
    {
      ...config,
      baseURL: import.meta.env.API_EXPLORE_BASE_URL || '',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
      },
    }
  );
}

/**
 * queryUserMerchantList
 * APP 专用接口 用户接口查询可授权商户列表
 * @path POST /app/user/merchants/list
 */
export async function queryUserMerchantList(
  data: {
    /** 页码，从 0 开始，默认 0 */
    page: number;
    /** 每页条数，默认 10，最大 20 */
    pageSize: number;
  },
  config?: ApiRequestConfig
): Promise<
  ApiResponse<{
    code: number;
    data: {
      rows: Array<{
        siteId: string;
        domain: string;
        name: string;
        logo: string;
        authorized: boolean;
        expiresAt: number;
        remainingSeconds: number;
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
        siteId: string;
        domain: string;
        name: string;
        logo: string;
        authorized: boolean;
        expiresAt: number;
        remainingSeconds: number;
      }>;
      total: number;
      page: number;
      pageSize: number;
    };
    message: string;
  }>(`/app/user/merchants/list`, data, config);
}

/**
 * queryUserAuthorizationList
 * APP 专用接口 用户接口查询当前有效授权列表
 * @path POST /app/user/authorizations/list
 */
export async function queryUserAuthorizationList(
  data: {
    /** 页码，从 0 开始，默认 0 */
    page: number;
    /** 每页条数，默认 10，最大 20 */
    pageSize: number;
  },
  config?: ApiRequestConfig
): Promise<
  ApiResponse<{
    code: number;
    data: {
      rows: Array<{
        siteId: string;
        domain: string;
        name: string;
        logo: string;
        expiresAt: number;
        remainingSeconds: number;
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
        siteId: string;
        domain: string;
        name: string;
        logo: string;
        expiresAt: number;
        remainingSeconds: number;
      }>;
      total: number;
      page: number;
      pageSize: number;
    };
    message: string;
  }>(`/app/user/authorizations/list`, data, config);
}
