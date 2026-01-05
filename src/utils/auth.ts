import { Signer } from 'ethers';
import OSS from 'ali-oss';

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
