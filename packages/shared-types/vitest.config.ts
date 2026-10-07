import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@repo/shared-types': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    exclude: ['dist/**', 'node_modules/**'],
  },
});
