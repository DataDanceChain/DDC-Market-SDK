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
  file: File,
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

  // convert File to Buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log(
    'uplloadOssStsFile ossClient is:',
    accessKeyId,
    accessKeySecret,
    stsToken,
    region,
    fileName,
    bucket,
    ossClient,
    buffer
  );
  const result = await ossClient.put(fileName, buffer);
  return result;
};
