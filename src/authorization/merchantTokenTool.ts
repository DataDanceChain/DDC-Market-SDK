import crypto from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getKeyHash } from '../utils';

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

/**
 * 构造商户换 token 所需的 `appId` / `timestamp` / `nonce` / `sign`。
 * 签名规则：`HMAC-SHA256(appSecret, appId={appId}&timestamp={timestamp}&nonce={nonce})`，digest 为 hex。
 */
export function buildMerchantAuthSignature(
  input: BuildMerchantAuthSignatureInput
): MerchantAuthSignature {
  const timestamp = input.timestamp ?? String(Math.floor(Date.now() / 1000));
  const nonce = input.nonce ?? crypto.randomBytes(12).toString('hex');
  const payload = `appId=${input.appId}&timestamp=${timestamp}&nonce=${nonce}`;
  const sign = crypto.createHmac('sha256', input.appSecret).update(payload).digest('hex');

  return { appId: input.appId, timestamp, nonce, sign };
}

function getArg(argv: string[], name: string) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  return argv[index + 1];
}

function isExecutedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return fileURLToPath(import.meta.url) === resolve(entry);
}

if (isExecutedDirectly()) {
  const argv = process.argv.slice(2);
  const appId = getArg(argv, '--appId');
  const appSecret = getArg(argv, '--appSecret');

  if (!appId) {
    console.error('缺少参数: --appId');
    process.exit(1);
  }

  if (!appSecret) {
    console.error('缺少参数: --appSecret');
    process.exit(1);
  }

  console.log(JSON.stringify(buildMerchantAuthSignature({ appId, appSecret }), null, 2));
}

const runHash = (key: string) => {
  const hash = getKeyHash(key);
  console.log('runHash hash is: ', hash);
};
// runHash('f28803c57022b5b83585498b8b45c26eef984aaf9e50ac16131c0fdd4913b509');
