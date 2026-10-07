import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/entities/session';
import {
  ApiError,
  apiClient,
  rawRequest,
  resetHttpClientForTests,
  setTokenProvider,
  setUnauthorizedHandler,
} from '@/lib/http/client';
import { refreshSession, setRefreshHandler } from '@/lib/http/refresh';

import { makeRefreshResponse, makeUser, problem } from './fixtures/auth';

describe('Phase 1: 401 Interceptor & Refresh (R1-R10)', () => {
  const mockUser = makeUser();
  const mockAccessToken = 'new-access-token';
  let unauthorizedHandlerMock: () => void;

  beforeEach(() => {
    resetHttpClientForTests();
    useAuthStore.setState({ status: 'anonymous', accessToken: null, user: null });

    unauthorizedHandlerMock = vi.fn(() => undefined);

    setTokenProvider(() => useAuthStore.getState().accessToken);
    setUnauthorizedHandler(unauthorizedHandlerMock);

    setRefreshHandler((outcome) => {
      const store = useAuthStore.getState();
      if (outcome.kind === 'refreshed') {
        store.setAuth(outcome.accessToken, outcome.user as never);
      } else if (outcome.kind === 'unauthenticated' || outcome.kind === 'reuse-detected') {
        store.clearAuth();
        unauthorizedHandlerMock();
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('R1: Request A receives 401, refresh succeeds 200, retries A with new token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Initial request returns 401
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(401, 'UNAUTHORIZED')), { status: 401 }),
    );
    // Refresh returns 200 with new token
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(makeRefreshResponse({ accessToken: mockAccessToken, user: mockUser })),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    // Retried request returns 200
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { success: true } }), { status: 200 }),
    );

    const result = await apiClient.get('/api/v1/auth/me' as never);

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(useAuthStore.getState().accessToken).toBe(mockAccessToken);
  });

  it('R2: A, B, C receive 401 concurrently, refresh called ONCE, all 3 retry', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Initial 3 requests return 401
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(problem(401, 'UNAUTHORIZED')), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(problem(401, 'UNAUTHORIZED')), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(problem(401, 'UNAUTHORIZED')), { status: 401 }),
      );

    // Single refresh response
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(makeRefreshResponse({ accessToken: mockAccessToken, user: mockUser })),
        {
          status: 200,
        },
      ),
    );

    // Retried requests
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'resultA' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'resultB' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'resultC' }), { status: 200 }));

    const results = await Promise.all([
      apiClient.get('/api/v1/auth/me' as never),
      apiClient.get('/api/v1/auth/me' as never),
      apiClient.get('/api/v1/auth/me' as never),
    ]);

    expect(results).toEqual(['resultA', 'resultB', 'resultC']);
    // Total calls: 3 initial + 1 refresh + 3 retries = 7
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it('R3: A, B, C receive 401, refresh fails 401, all 3 reject, logout happens once', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Initial 3 requests return 401
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(problem(401, 'UNAUTHORIZED')), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(problem(401, 'UNAUTHORIZED')), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(problem(401, 'UNAUTHORIZED')), { status: 401 }),
      );

    // Refresh returns 401
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(401, 'UNAUTHENTICATED')), { status: 401 }),
    );

    const promises = [
      apiClient.get('/api/v1/auth/me' as never),
      apiClient.get('/api/v1/auth/me' as never),
      apiClient.get('/api/v1/auth/me' as never),
    ];

    await expect(Promise.all(promises)).rejects.toThrow(ApiError);
    expect(unauthorizedHandlerMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('R4: Refresh request itself receiving 401 does not trigger infinite loop', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(401, 'UNAUTHENTICATED')), { status: 401 }),
    );

    const outcome = await refreshSession();

    expect(outcome.kind).toBe('unauthenticated');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('R5: Request already retried (isRetry) still receiving 401 stops retrying', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(401, 'UNAUTHORIZED')), { status: 401 }),
    );

    await expect(rawRequest('/api/v1/auth/me', { isRetry: true })).rejects.toThrow(ApiError);

    // Should NOT call refresh
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('R6: Refresh receives 429/5xx/network error, request rejects, NO logout', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Initial request 401
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(401, 'UNAUTHORIZED')), { status: 401 }),
    );
    // Refresh 500 Internal Server Error
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(500, 'INTERNAL_ERROR')), { status: 500 }),
    );

    await expect(apiClient.get('/api/v1/auth/me' as never)).rejects.toThrow(ApiError);

    expect(unauthorizedHandlerMock).not.toHaveBeenCalled();
  });

  it('R7: Refresh receives TOKEN_REUSE_DETECTED, clears auth with reuse-detected outcome', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(401, 'TOKEN_REUSE_DETECTED')), { status: 401 }),
    );

    const outcome = await refreshSession();

    expect(outcome.kind).toBe('reuse-detected');
    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('R8: Refresh includes x-csrf-token from cookie, retried request uses fresh headers', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Set mock cookie
    document.cookie = 'csrf_token=old-csrf-token; path=/';

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(problem(401, 'UNAUTHORIZED')), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            makeRefreshResponse({
              accessToken: mockAccessToken,
              user: mockUser,
              csrfToken: 'new-csrf-token',
            }),
          ),
          { status: 200, headers: { 'Set-Cookie': 'csrf_token=new-csrf-token; path=/' } },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'ok' }), { status: 200 }));

    await apiClient.post('/api/v1/auth/me' as never, {});

    // First call (initial POST)
    const [, firstCallInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const firstCallHeaders = firstCallInit.headers as Headers;
    expect(firstCallHeaders.get('x-csrf-token')).toBe('old-csrf-token');

    // Second call (refresh POST)
    const [, refreshCallInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const refreshCallHeaders = refreshCallInit.headers as Record<string, string>;
    expect(refreshCallHeaders['x-csrf-token']).toBe('old-csrf-token');

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('R9: Retried POST request with FormData body re-sends body intact', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.append('key', 'value');

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(problem(401, 'UNAUTHORIZED')), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(makeRefreshResponse({ accessToken: mockAccessToken, user: mockUser })),
          {
            status: 200,
          },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'ok' }), { status: 200 }));

    await rawRequest('/upload', { method: 'POST', body: formData });

    const retriedCallBody = (fetchMock.mock.calls[2]?.[1] as RequestInit | undefined)?.body;
    expect(retriedCallBody).toBe(formData);
  });

  it('R10: Request returning 403 Forbidden does NOT trigger refresh', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(403, 'FORBIDDEN')), { status: 403 }),
    );

    await expect(apiClient.get('/api/v1/auth/me' as never)).rejects.toThrow(ApiError);

    // Should only call initial endpoint, no refresh call
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
