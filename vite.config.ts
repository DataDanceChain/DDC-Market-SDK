import { defineConfig, loadEnv } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      dts({
        insertTypesEntry: true,
        rollupTypes: true,
      }),
    ],
    build: {
      lib: {
        entry: './src/index.ts',
        name: 'DDCMarketSDK',
        formats: ['es', 'cjs'],
        fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
      },
      rollupOptions: {
        // 确保外部化依赖，不要打包进库
        external: ['axios', 'ethers'],
        output: {
          globals: {
            axios: 'axios',
            ethers: 'ethers',
          },
        },
      },
      sourcemap: true,
      outDir: 'dist',
    },
    define: {
      // 将环境变量注入到代码中
      // Vite 会在构建时将这些替换为实际值
      'import.meta.env': JSON.stringify(env),
    },
  };
});
