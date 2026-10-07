import { defineConfig } from 'vitest/config';

/**
 * Unit tests only. Anything that needs a real Postgres lives in
 * `*.integration.spec.ts` and runs from `vitest.integration.config.ts`.
 */
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    // Integration specs need a live Postgres and Redis; they run from
    // vitest.integration.config.ts, not here.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.spec.ts'],
    // docs/rules/08-testing.md B4: order must never be load-bearing.
    sequence: { shuffle: true },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/index.ts', 'src/core/database/schema/**'],
      thresholds: {
        // docs/rules/08-testing.md A4.
        'src/common/utils/**': { lines: 95, functions: 95, branches: 90, statements: 95 },
        'src/modules/**': { lines: 80, functions: 80, branches: 70, statements: 80 },
      },
    },
  },
  resolve: {
    alias: {
      '@/config': new URL('./src/config', import.meta.url).pathname,
      '@/common': new URL('./src/common', import.meta.url).pathname,
      '@/core': new URL('./src/core', import.meta.url).pathname,
      '@/integrations': new URL('./src/integrations', import.meta.url).pathname,
      '@/modules': new URL('./src/modules', import.meta.url).pathname,
    },
  },
});
