/**
 * Web3Auth Context Configuration
 *
 * This configuration is used by Web3AuthProvider to initialize the Web3Auth modal
 * Following the official documentation:
 * https://web3auth.io/docs/sdk/pnp/web/modal/vue
 */

import { type Web3AuthContextConfig } from '@web3auth/modal/vue';
import { WEB3AUTH_NETWORK, type Web3AuthOptions } from '@web3auth/modal';

// Test Client ID - Get your own from https://dashboard.web3auth.io/
// const clientId =
//   'BFLUrwWqnxkmniL_3uIPXPqa8VjCuyLAaDFz-lS7T7Ea9dC6d2W2hOt5dQk5q1KgE0W6P1zCr-AeteU-JElo-qg';
const clientId =
  'BJfvROlWHEr-dW9goSJ84HqdTNY_-nQ2H5lfLfwRkb5eO00PCAe4loIhyW37qCY16gKwGx2m744zRVZ-u1fn6DI';

// Chain configuration - Using DataDance Chain
// const chainConfig = {
//   // chainNamespace: CHAIN_NAMESPACES.EIP155,
//   chainId: '0xADDC', // DataDance Chain chain ID (44508 in hex)
//   rpcTarget: 'https://dev-exp-alpha.datadance.co/eth/rpc',
//   displayName: 'DataDance Chain',
//   blockExplorerUrl: 'https://dev-exp-alpha.datadance.co',
//   ticker: 'DDC',
//   tickerName: 'DataDance',
//   logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
// };

// Web3Auth options following official documentation
const web3AuthOptions: Web3AuthOptions = {
  clientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
  // uiConfig: {
  //   appName: 'DDC Market SDK Demo',
  //   theme: {
  //     primary: '#667eea',
  //   },
  //   mode: 'light',
  //   defaultLanguage: 'en',
  //   loginGridCol: 3,
  //   primaryButton: 'externalLogin',
  // },
};

// Web3Auth configuration for Provider pattern (following official structure)
const web3AuthContextConfig: Web3AuthContextConfig = {
  web3AuthOptions,
};

export default web3AuthContextConfig;
export { clientId };
