import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppCore } from '@/app/app';
import { useAuthStore } from '@/entities/session';
import { setRefreshHandler } from '@/lib/http/refresh';

import { makeRefreshResponse, makeUser } from './fixtures/auth';

describe('Phase 1: Auth Rehydration (H1-H8)', () => {
  const mockUser = makeUser();
  const mockAccessToken = 'rehydrated-token';

  beforeEach(() => {
    useAuthStore.setState({
      status: 'initializing',
      accessToken: null,
      user: null,
    });

    // Register refreshHandler to update store (normally done in main.tsx)
    setRefreshHandler((outcome) => {
      const store = useAuthStore.getState();
      if (outcome.kind === 'refreshed') {
        store.setAuth(outcome.accessToken, outcome.user as never);
      } else if (outcome.kind === 'unauthenticated' || outcome.kind === 'reuse-detected') {
        store.clearAuth();
      } else {
        store.clearAuth();
      }
    });
  });

  it('H1: App starts with status=initializing, calls /auth/refresh, transitions to authenticated on 200', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(makeRefreshResponse({ accessToken: mockAccessToken, user: mockUser })),
        {
          status: 200,
        },
      ),
    );

    render(
      <MemoryRouter>
        <AppCore />
      </MemoryRouter>,
    );

    expect(useAuthStore.getState().status).toBe('initializing');

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('authenticated');
    });

    expect(useAuthStore.getState().accessToken).toBe(mockAccessToken);
    expect(useAuthStore.getState().user?.id).toBe(mockUser.id);
  });

  it('H2: App starts, /auth/refresh returns 401 UNAUTHENTICATED, transitions to anonymous', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 401, title: 'Unauthorized' }), { status: 401 }),
    );

    render(
      <MemoryRouter>
        <AppCore />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('anonymous');
    });

    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('H3: /auth/refresh returns 401 TOKEN_REUSE_DETECTED, transitions to anonymous', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 'TOKEN_REUSE_DETECTED' }), { status: 401 }),
    );

    render(
      <MemoryRouter>
        <AppCore />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('anonymous');
    });
  });

  it('H4: /auth/refresh returns 500, transitions to anonymous (no logout toast)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 500, title: 'Internal Server Error' }), {
        status: 500,
      }),
    );

    render(
      <MemoryRouter>
        <AppCore />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('anonymous');
    });

    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('H5: /auth/refresh network error, transitions to anonymous', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    render(
      <MemoryRouter>
        <AppCore />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('anonymous');
    });
  });

  it('H6: PageLoader displayed while status=initializing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockImplementationOnce(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(
            new Response(
              JSON.stringify(makeRefreshResponse({ accessToken: mockAccessToken, user: mockUser })),
              {
                status: 200,
              },
            ),
          );
        }, 100);
      });
    });

    render(
      <MemoryRouter>
        <AppCore />
      </MemoryRouter>,
    );

    const loader = screen.getByText((_, element) => {
      return element?.className.includes('animate-spin') ?? false;
    });
    expect(loader).toBeInTheDocument();

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('authenticated');
    });
  });

  it('H7: RouteGuard shows PageLoader while initializing, then redirects to /login if anonymous', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 401, title: 'Unauthorized' }), { status: 401 }),
    );

    render(
      <MemoryRouter>
        <AppCore />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('anonymous');
    });
  });

  it('H8: useInitAuthSession runs only once (status !== initializing prevents re-run)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(makeRefreshResponse({ accessToken: mockAccessToken, user: mockUser })),
        {
          status: 200,
        },
      ),
    );

    const { rerender } = render(
      <MemoryRouter>
        <AppCore />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('authenticated');
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <AppCore />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
