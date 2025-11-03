<script setup lang="ts">
/**
 * DDC Market SDK Demo Application
 *
 * Router container for the refactored application
 * Routes:
 * - / : Home page with wallet selector
 * - /metamask : MetaMask wallet mode
 * - /web3auth : Web3Auth wallet mode
 */
</script>

<template>
  <div id="app">
    <!-- Router View - renders the matched component -->
    <RouterView />
  </div>
</template>

<style>
/* Global Styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: 100vh;
  padding: 2rem;
}

#app {
  width: 100%;
}

/* Common utility classes */
.text-center {
  text-align: center;
}

code {
  font-family: 'Monaco', 'Courier New', monospace;
}
</style>
