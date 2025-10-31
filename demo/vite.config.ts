import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Force demo to consume SDK's prebuilt ESM output
      '@ddc-market/sdk': path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/esm/index.js'),
    },
  },
  optimizeDeps: {
    // Avoid pre-bundling the SDK; use the built output as-is
    exclude: ['@ddc-market/sdk'],
  },
})
