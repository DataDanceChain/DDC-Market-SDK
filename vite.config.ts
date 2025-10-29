import { defineConfig, loadEnv } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    json: {
      // JSON files can be imported as named exports
      namedExports: true,
      // JSON files can be imported as default export
      stringify: false,
    },
    plugins: [
      dts({
        insertTypesEntry: false,
        rollupTypes: true,
        outDir: 'dist/esm',
        copyDtsFiles: false,
      }),
    ],
    build: {
      lib: {
        entry: './src/index.ts',
        name: 'DDCMarketSDK',
      },
      rollupOptions: {
        // 确保外部化依赖，不要打包进库
        external: ['axios', 'ethers'],
        output: [
          {
            format: 'es',
            entryFileNames: 'esm/index.js',
          },
          {
            format: 'cjs',
            entryFileNames: 'cjs/index.js',
          },
        ],
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
