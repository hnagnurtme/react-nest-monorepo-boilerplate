import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@repo/shared-types': fileURLToPath(
        new URL('../../packages/shared-types/src', import.meta.url),
      ),
      '@repo/api-contract': fileURLToPath(
        new URL('../../packages/api-contract/src', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './test/setup.ts',
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
      thresholds: {
        'src/lib/http/**': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        'src/lib/auth/**': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        'src/app/components/route-guard.tsx': {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
        'src/features/auth/api/**': {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85,
        },
      },
    },
  },
});
