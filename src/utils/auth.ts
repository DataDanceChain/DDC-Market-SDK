import { Signer } from 'ethers';
import OSS from 'ali-oss';
import { MerchantAuthSignature, BuildMerchantAuthSignatureInput } from '../types/auth';

export const buildLoginMessage = function (params: {
  address: string;
  nonce: string;
  expiresAt: string;
  domain?: string;
}) {
  const { address, nonce, expiresAt, domain } = params;
  const issuedAt = new Date().toISOString();
  const safeDomain = domain || window?.location?.host || '';

  return [
    'DDC Market SDK Sign-In',
    `Domain: ${safeDomain}`,
    `Address: ${address.toLowerCase()}`,
    `Nonce: ${nonce}`,
    `ExpiresAt: ${expiresAt}`,
    `IssuedAt: ${issuedAt}`,
  ].join('\n');
};

export const signLoginMessage = async function (signer: Signer, message: string) {
  const signature = await signer.signMessage(message);
  const walletAddress = await signer.getAddress();

  return { signature, walletAddress };
};

export const uplloadOssStsFile = async function (
  file: File | Record<string, any>,
  config: {
    fileName: string;
    accessKeyId: string;
    accessKeySecret: string;
    stsToken: string;
    region: string;
    bucket: string;
  }
) {
  const { accessKeyId, accessKeySecret, stsToken, region, fileName, bucket } = config;
  const ossClient = new OSS({
    accessKeyId,
    accessKeySecret,
    region,
    stsToken,
    bucket,
    // refreshSTSToken: true,
  });

  let buffer: Buffer;
  let contentType: string | undefined;

  // convert File to Buffer
  if (file instanceof File) {
    // 处理 File 对象
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    contentType = file.type; // 使用原始文件的 MIME 类型
  } else {
    // 处理 JSON 对象：转换为 JSON 字符串，再转为 Buffer
    const jsonString = JSON.stringify(file, null, 2); // 格式化 JSON，可选
    buffer = Buffer.from(jsonString, 'utf-8');
    contentType = 'application/json'; // 设置 JSON 的 Content-Type
  }
  const result = await ossClient.put(fileName, buffer, {
    headers: {
      'Content-Type': contentType,
    },
  });
  return result;
};

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const getWebCrypto = (): Crypto => {
  const webCrypto = (globalThis as { crypto?: Crypto }).crypto;
  if (!webCrypto?.subtle) {
    throw new Error(
      'Web Crypto API is not available in this environment. Requires a modern browser or Node.js >= 18.'
    );
  }
  return webCrypto;
};

/**
 * 构造商户换 token 所需的 `appId` / `timestamp` / `nonce` / `sign`。
 * 签名规则：`HMAC-SHA256(appSecret, appId={appId}&timestamp={timestamp}&nonce={nonce})`，digest 为 hex。
 * 基于 Web Crypto API 实现，可在浏览器和 Node.js (>=18) 中通用。
 */
export async function buildMerchantAuthSignature(
  input: BuildMerchantAuthSignatureInput
): Promise<MerchantAuthSignature> {
  const webCrypto = getWebCrypto();
  const timestamp = input.timestamp ?? String(Math.floor(Date.now() / 1000));
  const nonce = input.nonce ?? bytesToHex(webCrypto.getRandomValues(new Uint8Array(12)));
  const payload = `appId=${input.appId}&timestamp=${timestamp}&nonce=${nonce}`;

  const encoder = new TextEncoder();
  const key = await webCrypto.subtle.importKey(
    'raw',
    encoder.encode(input.appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await webCrypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const sign = bytesToHex(new Uint8Array(signatureBuffer));

  return { appId: input.appId, timestamp, nonce, sign };
}
