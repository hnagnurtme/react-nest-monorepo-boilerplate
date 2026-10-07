import { defineConfig } from 'vitest/config';

/**
 * Needs a live Postgres: DATABASE_URL must point at the app role (NOBYPASSRLS)
 * and MIGRATION_DATABASE_URL at the owner role. Running the RLS suite as the
 * owner would pass while proving nothing — see docs/rules/08-testing.md C2.
 */
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.integration.spec.ts', 'test/**/*.integration.spec.ts'],
    // Shared database: parallel files would trample each other's rows.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
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
