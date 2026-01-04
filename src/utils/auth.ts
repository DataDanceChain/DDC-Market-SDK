import { Signer } from 'ethers';

export const buildLoginMessage = function (params: {
  address: string;
  nonce: string;
  expiresAt: string;
  domain?: string;
}) {
  const { address, nonce, expiresAt, domain } = params;
  const issuedAt = new Date().toISOString();
  const safeDomain = domain || window.location.host;

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
