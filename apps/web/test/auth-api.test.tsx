import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AUTH_ENDPOINTS, useChangePassword } from '@/features/auth';

import { jsonResponse } from './fixtures/auth';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useChangePassword', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the current and new password to the change-password endpoint', async () => {
    const fetchMock = vi
      .fn<(url: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(jsonResponse({ data: { message: 'changed' } }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useChangePassword(), { wrapper });

    result.current.mutate({
      currentPassword: 'Password123!',
      newPassword: 'NewPassword123!',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toContain(AUTH_ENDPOINTS.CHANGE_PASSWORD);
    expect(JSON.parse(init?.body as string)).toEqual({
      currentPassword: 'Password123!',
      newPassword: 'NewPassword123!',
    });
  });
});
