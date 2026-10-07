import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';

/** Fills `<title>` from VITE_APP_NAME, with the same default the app uses at runtime. */
function appTitle(appName: string) {
  return {
    name: 'app-title',
    transformIndexHtml: {
      order: 'pre' as const,
      handler: (html: string) => html.replaceAll('%APP_TITLE%', appName),
    },
  };
}

/*
 * The design tokens stay in CSS (one source of truth) but the WCAG contrast test
 * has to read them. A `?raw` import would already have been compiled by the
 * Tailwind plugin, so the raw text is injected at config time instead.
 */
const globalsCss = readFileSync(
  fileURLToPath(new URL('./src/app/styles/globals.css', import.meta.url)),
  'utf8',
);

export default defineConfig(({ mode }) => ({
  define: {
    GLOBALS_CSS_RAW: JSON.stringify(globalsCss),
  },
  plugins: [
    react(),
    tailwindcss(),
    appTitle(loadEnv(mode, process.cwd(), 'VITE_')['VITE_APP_NAME']?.trim() || 'Starter App'),
  ],
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
}));
