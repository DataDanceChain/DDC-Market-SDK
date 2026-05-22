// 商户角色, 商户接入admin 之后 可以在自己的网站内 获取用户授权 查看用户 NFT

// 授权流程:
// 初始化 -> 获取商户信息 -> 调用合约 获取授权 -> 绑定钱包和siteid

import {
  Contract,
  ContractTransactionResponse,
  ContractTransactionReceipt,
  Provider,
  BrowserProvider,
  JsonRpcProvider,
  Interface,
  Signer,
} from 'ethers';
import { SDKError } from '../types';
import {
  resolveProvider,
  getSigner,
  ensureCorrectNetwork,
  resolveWalletAddress,
  Logger,
  validateAddress,
} from '../utils';
import { getDDCConfig } from '../service/api';
import {
  MerchantInfo,
  MerchantConfig,
  MerchantParams,
  UserAuthOptions,
  UserAuthResult,
  RevokeUserAuthResult,
  UserAuthorizationInfo,
} from '../types/auth';
import {
  queryMerchantInfo,
  getToken,
  getNftList,
  setUserHash,
  unBindUserHash,
  queryUserMerchantList,
  queryUserAuthorizationList,
  getUserHashList,
  getNftDetail,
} from '../service/api/merchant';
import { buildMerchantAuthSignature } from '../utils/auth';
import { AUTHORIZATION_ABI, IDDCNFT_AUTHORIZATION_ABI } from '../abi';
import Base from './Base';
import { signAdminToken, signUserToken } from './appAdminTokenTool';

const DEFAULT_MIN_AUTH_DURATION_SECONDS = 60;
const DEFAULT_MAX_AUTH_DURATION_SECONDS = 365 * 24 * 60 * 60;
// const BYTES32_ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';

type DDCConfigData = NonNullable<Awaited<ReturnType<typeof getDDCConfig>>['data']>['data'] & {
  authorization_address?: string;
};

class Merchant extends Base {
  protected static instance: Merchant | null = null;

  protected merchantInfo?: MerchantInfo;
  protected minAuthDurationSeconds = DEFAULT_MIN_AUTH_DURATION_SECONDS;
  protected maxAuthDurationSeconds = DEFAULT_MAX_AUTH_DURATION_SECONDS;

  constructor(config: MerchantConfig) {
    super(config);

    if (config?.provider && config?.network) {
      const { provider, network, signerConfig } = config;
      this.provider = provider;
      this.signerConfig = signerConfig;
      this.networkConfig = network;

      this.logger.info(`Initializing Merchant}`, {
        hasFactory: !!config.factoryAddress,
        network: network.chain_name || 'not specified',
        chain_id: network.chain_id,
        providerType: provider.constructor.name,
      });
    }
  }

  protected async getSigner(): Promise<Signer> {
    if (!this.provider) {
      throw new SDKError('Provider is not available', 'PROVIDER_NOT_AVAILABLE');
    }
    return getSigner(this.provider, this.signerConfig);
  }

  protected requireSiteId(): string {
    if (!this.merchantInfo?.siteId) {
      throw new SDKError(
        'Merchant siteId is not available. Call Merchant.init() first.',
        'MERCHANT_NOT_INITIALIZED'
      );
    }
    const siteId = this.merchantInfo.siteId;
    return siteId;
  }

  protected requireAuthorizationContractAddress(): string {
    if (!this.merchantInfo?.authorization_contract_address) {
      throw new SDKError(
        'Authorization contract address is not configured. Provide authorizationContractAddress in Merchant.init() params or ensure getDDCConfig returns authorization_address.',
        'MISSING_AUTHORIZATION_CONTRACT'
      );
    }
    validateAddress(
      this.merchantInfo?.authorization_contract_address,
      'Authorization contract address'
    );
    return this.merchantInfo?.authorization_contract_address;
  }

  protected getAuthorizationContract(runner: Signer | Provider): Contract {
    const address = this.requireAuthorizationContractAddress();
    try {
      return new Contract(address, IDDCNFT_AUTHORIZATION_ABI, runner);
    } catch (error) {
      throw new SDKError(
        `Failed to create authorization contract instance: ${error}`,
        'CONTRACT_CREATION_ERROR',
        { address, error }
      );
    }
  }

  public async loadDurationLimits(): Promise<void> {
    if (!this.merchantInfo?.authorization_contract_address || !this.provider) return;

    try {
      const contract = new Contract(
        this.merchantInfo?.authorization_contract_address,
        AUTHORIZATION_ABI,
        this.provider
      );
      const [minDuration, maxDuration] = await Promise.all([
        contract.MIN_DURATION(),
        contract.MAX_DURATION(),
      ]);
      this.minAuthDurationSeconds = Number(minDuration);
      this.maxAuthDurationSeconds = Number(maxDuration);
    } catch (error) {
      this.logger.warn(
        'Failed to read authorization duration limits from contract, using defaults',
        error
      );
    }
  }

  protected validateDurationSeconds(durationSeconds: number): void {
    if (
      !Number.isInteger(durationSeconds) ||
      durationSeconds < this.minAuthDurationSeconds ||
      durationSeconds > this.maxAuthDurationSeconds
    ) {
      throw new SDKError(
        `durationSeconds must be an integer between ${this.minAuthDurationSeconds} and ${this.maxAuthDurationSeconds}`,
        'INVALID_PARAMETER',
        { durationSeconds }
      );
    }
  }

  protected parseAuthorizationError(error: any): SDKError | null {
    const errorData = error?.data ?? error?.info?.error?.data;
    if (!errorData || typeof errorData !== 'string') return null;

    try {
      const authInterface = new Interface(AUTHORIZATION_ABI);
      const parsed = authInterface.parseError(errorData);
      if (!parsed) return null;

      switch (parsed.name) {
        case 'DurationOutOfRange':
          return new SDKError(
            `durationSeconds must be between ${this.minAuthDurationSeconds} and ${this.maxAuthDurationSeconds}`,
            'DURATION_OUT_OF_RANGE',
            { duration: parsed.args.duration?.toString() }
          );
        case 'InvalidSiteId':
          return new SDKError('siteId cannot be bytes32 zero value', 'INVALID_SITE_ID');
        case 'NotAuthorized':
          return new SDKError('Authorization does not exist or has expired', 'NOT_AUTHORIZED');
        default:
          return new SDKError(
            `Authorization contract reverted: ${parsed.name}`,
            'AUTHORIZATION_CONTRACT_ERROR',
            { errorName: parsed.name, args: parsed.args }
          );
      }
    } catch {
      return null;
    }
  }

  protected async resolveOptionalWalletAddress(walletAddress?: string): Promise<string> {
    const resolvedWalletAddress = walletAddress ?? (await (await this.getSigner()).getAddress());
    validateAddress(resolvedWalletAddress, 'Wallet address');
    return resolvedWalletAddress;
  }

  protected rethrowAuthorizationTxError(error: any, context: Record<string, unknown>): never {
    if (error instanceof SDKError) throw error;

    const parsedError = this.parseAuthorizationError(error);
    if (parsedError) throw parsedError;

    if (error.code === 'INSUFFICIENT_FUNDS') {
      throw new SDKError('Insufficient funds to pay for gas fees.', 'INSUFFICIENT_FUNDS', {
        ...context,
        error: error.message,
      });
    }

    if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
      throw new SDKError('Transaction was rejected by user.', 'USER_REJECTED', {
        ...context,
        error: error.message,
      });
    }

    throw new SDKError(
      `Authorization transaction failed: ${error.message || error}`,
      'USER_AUTH_ERROR',
      { ...context, error: error.message || error }
    );
  }

  protected parseAuthorizedEvent(
    receipt: { logs: Array<{ topics: readonly string[]; data: string }> },
    expectedSiteId: string
  ): number {
    const authInterface = new Interface(IDDCNFT_AUTHORIZATION_ABI);

    for (const log of receipt.logs) {
      try {
        const parsed = authInterface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (parsed?.name !== 'Authorized') continue;

        const siteId = String(parsed.args.siteId);
        if (siteId.toLowerCase() !== expectedSiteId.toLowerCase()) continue;

        return Number(parsed.args.expiresAt);
      } catch {
        continue;
      }
    }

    throw new SDKError('Authorized event not found in transaction receipt', 'EVENT_PARSE_ERROR', {
      expectedSiteId,
    });
  }

  static async init(merchantConfig: MerchantParams): Promise<Merchant> {
    if (!merchantConfig) {
      throw new SDKError('Manager configuration cannot be empty', 'INVALID_PARAMETER', {
        merchantConfig,
      });
    }

    const { walletAddress, provider, signer, debug, appId } = merchantConfig;

    const resolvedWalletAddress = resolveWalletAddress(provider, walletAddress, signer);

    const result = await getDDCConfig({ address: resolvedWalletAddress });

    if (!result.success) {
      throw new SDKError('Failed to get DDC config', 'DDC_CONFIG_ERROR', { result });
    }

    const ddcConfig = result.data.data as DDCConfigData;
    const { network, nft_factory_address, authorization_contract_address } = ddcConfig;

    const resolvedProvider = resolveProvider(provider, network);

    if (resolvedProvider instanceof JsonRpcProvider && !signer) {
      throw new SDKError(
        'Signer configuration is required for JsonRpcProvider mode. Please provide signer with privateKey.',
        'MISSING_SIGNER_CONFIG',
        { providerType: 'JsonRpcProvider' }
      );
    }

    const config: MerchantConfig = {
      provider: resolvedProvider,
      debug: debug || false,
      network: network,
      factoryAddress: nft_factory_address,
      signerConfig: signer,
      appId,
    };

    const instance = new Merchant(config);
    this.instance = instance;
    await instance.ensureNetwork();
    await instance.loadDurationLimits();

    const res = await queryMerchantInfo(appId);
    const { appId: ad, siteId, domain, name, logo } = res.data?.data || {};

    instance.merchantInfo = {
      appId: ad || '',
      siteId: siteId || '',
      domain: domain || '',
      siteName: name || '',
      logo: logo || '',
      status: '',
      authorization_contract_address,
    };
    return instance;
  }

  /**
   * 用户对当前商户站点发起链上授权
   * 调用 IDDCNFTAuthorization.authorize(bytes32 siteId, uint64 durationSeconds)。
   */
  public async userAuth(
    durationSeconds: number,
    options?: UserAuthOptions
  ): Promise<UserAuthResult> {
    const siteId = this.requireSiteId();
    this.requireAuthorizationContractAddress();
    this.validateDurationSeconds(durationSeconds);
    await this.ensureNetwork();

    const signer = await this.getSigner();
    const walletAddress = await signer.getAddress();
    const contract = this.getAuthorizationContract(signer);

    try {
      // 与 BaseManager.deployFactory 一致：先拿到交易句柄，校验后再 wait 取 receipt
      const authorizationTx: ContractTransactionResponse = await contract.authorize(
        siteId,
        durationSeconds
      );

      if (!authorizationTx.hash) {
        throw new SDKError('Authorization transaction not available', 'TRANSACTION_NOT_AVAILABLE');
      }

      const receipt: ContractTransactionReceipt | null = await authorizationTx.wait();
      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      const expiresAt = this.parseAuthorizedEvent(receipt, siteId);
      // let hashBound = false;

      // if (options?.hash) {
      //   const hashResult = await setUserHash({
      //     address: walletAddress,
      //     hash: options.hash,
      //   });
      //   hashBound = hashResult.data?.data?.result === true;
      //   if (!hashBound) {
      //     this.logger.warn('Authorization succeeded but failed to bind user hash', {
      //       walletAddress,
      //     });
      //   }
      // }

      return {
        transactionHash: receipt.hash,
        walletAddress,
        siteId,
        expiresAt,
        blockNumber: receipt.blockNumber,
        // hashBound,
      };
    } catch (error: any) {
      this.rethrowAuthorizationTxError(error, { siteId, durationSeconds });
    }
  }

  /**
   * 用户撤销对当前商户站点的链上授权。
   * 调用 IDDCNFTAuthorization.revoke(bytes32 siteId)。
   */
  public async revokeUserAuth(): Promise<RevokeUserAuthResult> {
    const siteId = this.requireSiteId();
    this.requireAuthorizationContractAddress();
    await this.ensureNetwork();

    const signer = await this.getSigner();
    const walletAddress = await signer.getAddress();
    const contract = this.getAuthorizationContract(signer);

    try {
      const revokeTx: ContractTransactionResponse = await contract.revoke(siteId);
      if (!revokeTx.hash) {
        throw new SDKError('Revoke transaction not available', 'TRANSACTION_NOT_AVAILABLE');
      }

      const receipt: ContractTransactionReceipt | null = await revokeTx.wait();
      if (!receipt) {
        throw new SDKError('Transaction receipt not available', 'TX_RECEIPT_ERROR');
      }

      return {
        transactionHash: receipt.hash,
        walletAddress,
        siteId,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      this.rethrowAuthorizationTxError(error, { siteId });
    }
  }

  /**
   * 查询指定钱包对当前商户站点的授权状态。
   */
  public async isUserAuthorized(walletAddress?: string): Promise<boolean> {
    const siteId = this.requireSiteId();
    this.requireAuthorizationContractAddress();

    if (!this.provider) {
      throw new SDKError('Provider is not available', 'PROVIDER_NOT_AVAILABLE');
    }

    const resolvedWalletAddress = await this.resolveOptionalWalletAddress(walletAddress);

    const contract = this.getAuthorizationContract(this.provider);
    return contract.isAuthorized(resolvedWalletAddress, siteId);
  }

  /**
   * 查询指定钱包对当前商户站点的完整授权信息。
   */
  public async getUserAuthorization(walletAddress?: string): Promise<UserAuthorizationInfo> {
    const siteId = this.requireSiteId();
    this.requireAuthorizationContractAddress();

    if (!this.provider) {
      throw new SDKError('Provider is not available', 'PROVIDER_NOT_AVAILABLE');
    }

    const resolvedWalletAddress = await this.resolveOptionalWalletAddress(walletAddress);

    const contract = this.getAuthorizationContract(this.provider);
    const result = await contract.getAuthorization(resolvedWalletAddress, siteId);

    return {
      walletAddress: resolvedWalletAddress,
      siteId,
      authorized: result.authorized,
      expiresAt: Number(result.expiresAt),
      remainingSeconds: Number(result.remainingSeconds),
    };
  }

  // 增加绑定 hash 和 钱包地址的方法, 让用户自行绑定
  public async bindUserHash(hash: string, walletAddress: string, secret: string): Promise<boolean> {
    const jwt = await signUserToken({
      secret,
      wallet: walletAddress,
    });

    const hashResult = await setUserHash(
      {
        hash,
      },
      { headers: { Authorization: `Bearer ${jwt.token}` } }
    );

    const success = hashResult.data?.data === true;
    if (!success) {
      this.logger.warn('Failed to bind user hash', {
        walletAddress,
      });
    }

    return success;
  }

  // 解除绑定 hash 和 钱包地址的方法
  public async unbindUserHash(
    hash: string,
    walletAddress: string,
    secret: string
  ): Promise<boolean> {
    const jwt = await signUserToken({
      secret,
      wallet: walletAddress,
    });

    const hashResult = await unBindUserHash(
      {
        hash,
      },
      { headers: { Authorization: `Bearer ${jwt.token}` } }
    );

    const success = hashResult.data?.data === true;
    if (!success) {
      this.logger.warn('Failed to unbind user hash', {
        walletAddress,
      });
    }

    return success;
  }

  // 解除绑定 hash 和 钱包地址的方法
  public async queryUserHashList(
    page: {
      page: number;
      pageSize: number;
    },
    walletAddress: string,
    secret: string
  ): Promise<{
    page: number;
    pageSize: number;
    total: number;
    rows: Array<{
      hash: string;
      createdAt: string;
    }>;
  } | null> {
    const jwt = await signUserToken({
      secret,
      wallet: walletAddress,
    });

    const hashResult = await getUserHashList(page, {
      headers: { Authorization: `Bearer ${jwt.token}` },
    });

    // const success = hashResult.data?.data === true;
    // if (!success) {
    //   this.logger.warn('Failed to query user list', {
    //     walletAddress,
    //   });
    // }

    return hashResult.data?.data || null;
  }

  /**
   * 1. 获取商户 access token。 使用 HMAC-SHA256 签名向 /auth/merchant/token 换取 token。
   * 2. getNftList 获取合约 nft 列表
   */
  public async queryTokenList(
    appSecret: string,
    address: string,
    pageNo: number
  ): Promise<{
    Rows: Array<{
      token: string;
      tokenId: string;
      owner: string;
      name: string;
      image: string;
    }>;
  } | null> {
    const appId = this.merchantInfo?.appId;
    if (!appId) {
      throw new SDKError(
        'Merchant appId is not available. Call Merchant.init() first.',
        'MERCHANT_NOT_INITIALIZED'
      );
    }

    const signature = await buildMerchantAuthSignature({ appId, appSecret });
    const result = await getToken(signature);

    if (!result.success) {
      throw new SDKError('Failed to get merchant token', 'GET_TOKEN_ERROR', {
        error: result.error,
      });
    }

    const tokenData = result.data?.data;
    if (!tokenData?.accessToken) {
      throw new SDKError('Token data is empty in response', 'GET_TOKEN_ERROR', {
        response: result.data,
      });
    }

    const res = await getNftList({
      address,
      accessToken: tokenData.accessToken,
      page: {
        page: pageNo,
        pageSize: 100,
      },
    });

    return res.data?.data || null;
  }

  /**
   * 1. 获取商户 access token。 使用 HMAC-SHA256 签名向 /auth/merchant/token 换取 token。
   * 2. getNftList 获取合约 nft 列表
   */
  public async queryNftTokenDetail(
    appSecret: string,
    address: string,
    contractAddress: string,
    tokenId: string
  ): Promise<{
    token: string; // "0x...",
    tokenId: string; // "216",
    metadata: {
      name: string; // "",
      image: string; // ""
    };
  } | null> {
    const appId = this.merchantInfo?.appId;
    if (!appId) {
      throw new SDKError(
        'Merchant appId is not available. Call Merchant.init() first.',
        'MERCHANT_NOT_INITIALIZED'
      );
    }

    const signature = await buildMerchantAuthSignature({ appId, appSecret });
    const result = await getToken(signature);

    if (!result.success) {
      throw new SDKError('Failed to get merchant token', 'GET_TOKEN_ERROR', {
        error: result.error,
      });
    }

    const tokenData = result.data?.data;
    if (!tokenData?.accessToken) {
      throw new SDKError('Token data is empty in response', 'GET_TOKEN_ERROR', {
        response: result.data,
      });
    }

    const res = await getNftDetail({
      address,
      accessToken: tokenData.accessToken,
      contractAddress,
      tokenId,
    });

    return res.data?.data || null;
  }

  /**
   * 用户接口查询可授权商户列表（App 专用接口）
   * 通过 HMAC-SHA256 签名换取 accessToken，再以 Bearer 方式调用
   * POST /app/user/merchants/list。
   *
   * @param appSecret - App 密钥
   * @param page      - 页码，从 0 开始，默认 0
   * @param pageSize  - 每页条数，默认 10，最大 20
   */
  public async queryAppMechants(
    wallet: string,
    secret: string,
    page = 0,
    pageSize = 10
  ): Promise<{
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
  } | null> {
    const appId = this.merchantInfo?.appId;
    if (!appId) {
      throw new SDKError(
        'Merchant appId is not available. Call Merchant.init() first.',
        'MERCHANT_NOT_INITIALIZED'
      );
    }

    const jwt = await signUserToken({ secret, wallet });

    console.log('debug queryAppMechants token', new Date(), JSON.stringify(jwt));

    const res = await queryUserMerchantList(
      { page, pageSize },
      { headers: { Authorization: `Bearer ${jwt.token}` } }
    );
    return res.data?.data || null;
  }

  /**
   * 用户接口查询当前有效授权列表（App 专用接口）
   * 通过 HMAC-SHA256 签名换取 accessToken，再以 Bearer 方式调用
   * POST /app/user/authorizations/list。
   *
   * @param appSecret - App 密钥
   * @param page      - 页码，从 0 开始，默认 0
   * @param pageSize  - 每页条数，默认 10，最大 20
   */
  public async queryAppAuthorizedMechants(
    wallet: string,
    secret: string,
    page = 0,
    pageSize = 10
  ): Promise<{
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
  } | null> {
    const appId = this.merchantInfo?.appId;
    if (!appId) {
      throw new SDKError(
        'Merchant appId is not available. Call Merchant.init() first.',
        'MERCHANT_NOT_INITIALIZED'
      );
    }

    const jwt = await signUserToken({ secret, wallet });

    console.log('debug queryAppAuthorizedMechants token', new Date(), jwt.token);

    const res = await queryUserAuthorizationList(
      { page, pageSize },
      { headers: { Authorization: `Bearer ${jwt.token}` } }
    );
    return res.data?.data || null;
  }
}

export default Merchant;
