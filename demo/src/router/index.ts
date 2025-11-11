/**
 * Router Configuration
 *
 * Routes:
 * / - Home page with wallet selector
 * /metamask - MetaMask wallet mode
 * /web3auth - Web3Auth wallet mode (with Provider wrapper)
 */

import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomePage.vue'),
      meta: {
        title: 'DDC Market SDK Demo - Choose Wallet',
      },
    },
    {
      path: '/metamask',
      name: 'metamask',
      component: () => import('../views/MetaMaskApp.vue'),
      meta: {
        title: 'DDC Market SDK Demo - MetaMask Mode',
      },
    },
    {
      path: '/web3auth',
      name: 'web3auth',
      component: () => import('../views/Web3AuthApp.vue'),
      meta: {
        title: 'DDC Market SDK Demo - Web3Auth Mode',
      },
    },
    {
      path: '/jsonrpc',
      name: 'jsonrpc',
      component: () => import('../views/JsonRpcProviderApp.vue'),
      meta: {
        title: 'DDC Market SDK Demo - JsonRpcProvider Mode',
      },
    },
  ],
});

// Update page title on route change
router.beforeEach((to, _from, next) => {
  if (to.meta.title) {
    document.title = to.meta.title as string;
  }
  next();
});

export default router;
