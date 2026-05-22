/**
 * App 钱包 JWT 工具。
 * 兼容浏览器和现代 Node.js（≥19）环境，使用 Web Crypto API 生成 HS256 JWT。
 *
 * 用法示例：
 *   import { signAdminToken, signUserToken } from './appAdminTokenTool';
 *   const { token } = await signAdminToken({ secret: 'xxx', ttlSec: 300 });
 *
 * CLI 用法（Node.js）：
 *   node tools/appAdminTokenTool.js --secret <hex> --ttl 9999999
 *   node tools/appAdminTokenTool.js --secret <hex> --ttl 9999999 --wallet 0xabc
 */

function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function hmacSha256(key: string, message: string): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface SignAdminTokenParams {
  /** JWT 签名密钥（hex 字符串） */
  secret: string;
  /** JWT 过期秒数，默认 300 */
  ttlSec?: number;
}

export interface SignUserTokenParams {
  /** JWT 签名密钥（hex 字符串） */
  secret: string;
  /** 用户钱包地址 */
  wallet: string;
  /** JWT 过期秒数，默认 300 */
  ttlSec?: number;
}

export interface SignTokenParams {
  /** 调用方身份 */
  actorType: 'app_admin' | 'app_user';
  /** JWT 签名密钥（hex 字符串） */
  secret: string;
  /** 钱包地址（app_user 模式需要） */
  wallet?: string;
  /** JWT 过期秒数，默认 300 */
  ttlSec?: number;
}

export interface JwtTokenResult {
  /** 生成的 JWT 字符串 */
  token: string;
  /** JWT 过期 Unix 秒时间戳 */
  expiresAtSec: number;
  /** JWT payload 对象 */
  payload: Record<string, unknown>;
}

async function signToken(params: SignTokenParams): Promise<JwtTokenResult> {
  const { actorType, secret, wallet = '', ttlSec = 300 } = params;
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: Record<string, unknown> = {
    sub: 'ddc-wallet-app',
    jti: randomHex(8),
    actorType: String(actorType),
    iat: nowSec,
    exp: nowSec + Math.max(1, Number(ttlSec) || 300),
    iss: 'ddc-wallet-app',
    aud: 'ddc-market-engine',
  };
  if (actorType === 'app_user') {
    payload.wallet = String(wallet).trim();
  }

  const headB64 = base64UrlEncode(JSON.stringify(header));
  const bodyB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headB64}.${bodyB64}`;
  const signature = await hmacSha256(String(secret), signingInput);

  return {
    token: `${signingInput}.${arrayBufferToBase64Url(signature)}`,
    expiresAtSec: payload.exp as number,
    payload,
  };
}

/** 生成 app_admin 身份 JWT */
export async function signAdminToken(params: SignAdminTokenParams): Promise<JwtTokenResult> {
  return signToken({ actorType: 'app_admin', ...params });
}

/** 生成 app_user 身份 JWT */
export async function signUserToken(params: SignUserTokenParams): Promise<JwtTokenResult> {
  return signToken({ actorType: 'app_user', ...params });
}

/** 向后兼容的静态工具类（CLI 场景） */
export class AppWalletJwtTool {
  static getCliArg(args: string[], name: string): string | undefined {
    const index = args.indexOf(name);
    return index === -1 ? undefined : args[index + 1];
  }

  static parseTtlSec(value: string | undefined, fallbackSec = 300): number {
    const ttl = Number(String(value || '').trim() || fallbackSec);
    return Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : fallbackSec;
  }

  static async signAdminToken(params: SignAdminTokenParams): Promise<JwtTokenResult> {
    return signAdminToken(params);
  }

  static async signUserToken(params: SignUserTokenParams): Promise<JwtTokenResult> {
    return signUserToken(params);
  }

  static async signToken(params: SignTokenParams): Promise<JwtTokenResult> {
    return signToken(params);
  }
}
