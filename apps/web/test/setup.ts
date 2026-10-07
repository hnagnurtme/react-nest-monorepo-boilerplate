import '@testing-library/jest-dom/vitest';

import { afterEach, vi } from 'vitest';

import '@/lib/i18n';
import { useAuthStore } from '@/entities/session/store';
import { resetHttpClientForTests } from '@/lib/http/client';

// Stub fetch to fail by default — tests must explicitly mock endpoints
const defaultFetchStub = vi.fn((url: string) => {
  if (url.includes('/api/v1/auth/refresh')) {
    return Promise.resolve(
      new Response(JSON.stringify({ status: 401, title: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/problem+json' },
      }),
    );
  }
  throw new Error(`Unmocked fetch call to ${url}. Mock this endpoint in your test.`);
});

vi.stubGlobal('fetch', defaultFetchStub);

// Clean up after each test
afterEach(() => {
  // Reset auth store to initial state
  const { getState, setState } = useAuthStore;
  const initialState = getState();
  setState({
    ...initialState,
    status: 'initializing',
    accessToken: null,
    user: null,
  });

  // Reset HTTP client (includes refresh state)
  resetHttpClientForTests();

  // Clear all mocks
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();

  // Re-stub fetch for next test
  vi.stubGlobal('fetch', defaultFetchStub);

  // Clear cookies (jsdom doesn't have document.cookie fully functional, but we prepare for it)
  if (typeof document !== 'undefined' && document.cookie) {
    document.cookie.split(';').forEach((c) => {
      document.cookie = c
        .replace(/^ +/, '')
        .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
    });
  }
});
