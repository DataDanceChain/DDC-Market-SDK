import { ManagerConfig, ManagerParams } from './index';

export interface MerchantInfo {
  appId: string;
  siteId: string;
  siteName: string;
  domain: string;
  status: string;
  logo: string;
  authorization_contract_address: string;
}

export interface MerchantConfig extends ManagerConfig {
  appId: string;
}

export interface MerchantParams extends ManagerParams {
  appId: string;
}

export interface UserAuthOptions {
  /** 用户隐私 hash，授权成功后调用 /user/hash 绑定钱包 */
  hash?: string;
}

export interface UserAuthResult {
  transactionHash: string;
  walletAddress: string;
  siteId: string;
  expiresAt: number;
  blockNumber?: number;
  // hashBound: boolean;
}

export interface RevokeUserAuthResult {
  transactionHash: string;
  walletAddress: string;
  siteId: string;
  blockNumber?: number;
}

/** 对应合约 struct UserAuthorization */
export interface UserAuthorizationInfo {
  walletAddress: string;
  siteId: string;
  authorized: boolean;
  expiresAt: number;
  remainingSeconds: number;
}

// 商户授权
export type MerchantAuthSignature = {
  appId: string;
  timestamp: string;
  nonce: string;
  sign: string;
};

export type BuildMerchantAuthSignatureInput = {
  appId: string;
  appSecret: string;
  /** Unix 秒时间戳字符串；不传则使用当前时间 */
  timestamp?: string;
  /** 随机 nonce（hex）；不传则生成 12 字节随机数 */
  nonce?: string;
};
