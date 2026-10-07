import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/entities/session';

import { makeRefreshResponse, makeUser, problem } from './fixtures/auth';
import { renderApp } from './utils/render-app';

describe('Phase 1: Login Flow (L1-L7)', () => {
  const mockUser = makeUser({ email: 'admin@example.com' });
  const mockAccessToken = 'login-token';

  beforeEach(() => {
    useAuthStore.setState({ status: 'anonymous', accessToken: null, user: null });
  });

  it('L1: User submits valid credentials, API returns 200, store updated', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Mock refresh (initial mount)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(401, 'UNAUTHENTICATED')), { status: 401 }),
    );

    // Mock login success
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(makeRefreshResponse({ accessToken: mockAccessToken, user: mockUser })),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { container } = renderApp({ initialRoute: '/login' });

    await vi.waitFor(() => {
      expect(useAuthStore.getState().status).toBe('anonymous');
    });

    // Wait for form to render
    await vi.waitFor(() => {
      expect(container.querySelector('#auth-identity')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const emailInput = container.querySelector<HTMLInputElement>('#auth-identity')!;
    const passwordInput = container.querySelector<HTMLInputElement>('#auth-password')!;
    const submitButton = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    await user.type(emailInput, mockUser.email);
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await vi.waitFor(() => {
      expect(useAuthStore.getState().status).toBe('authenticated');
    });

    expect(useAuthStore.getState().accessToken).toBe(mockAccessToken);
    expect(useAuthStore.getState().user?.email).toBe(mockUser.email);
  });

  it('L2: API returns 401 INVALID_CREDENTIALS, no navigation', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Mock refresh
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(401, 'UNAUTHENTICATED')), { status: 401 }),
    );

    // Mock login failure
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(401, 'INVALID_CREDENTIALS')), { status: 401 }),
    );

    const { container } = renderApp({ initialRoute: '/login' });

    await vi.waitFor(() => {
      expect(useAuthStore.getState().status).toBe('anonymous');
    });

    const user = userEvent.setup();
    const emailInput = container.querySelector<HTMLInputElement>('#auth-identity')!;
    const passwordInput = container.querySelector<HTMLInputElement>('#auth-password')!;
    const submitButton = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    await user.type(emailInput, 'wrong@example.com');
    await user.type(passwordInput, 'wrongpass');
    await user.click(submitButton);

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('L3: API returns 422 validation error, stays on login page', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Mock refresh
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(401, 'UNAUTHENTICATED')), { status: 401 }),
    );

    // Mock validation error
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: 'https://httpstatuses.com/422',
          title: 'Validation Failed',
          status: 422,
          code: 'VALIDATION_ERROR',
          invalidParams: [{ name: 'email', reason: 'Invalid email format' }],
        }),
        { status: 422 },
      ),
    );

    const { container } = renderApp({ initialRoute: '/login' });

    await vi.waitFor(() => {
      expect(useAuthStore.getState().status).toBe('anonymous');
    });

    const user = userEvent.setup();
    const emailInput = container.querySelector<HTMLInputElement>('#auth-identity')!;
    const passwordInput = container.querySelector<HTMLInputElement>('#auth-password')!;
    const submitButton = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    await user.type(emailInput, 'invalid-email');
    await user.type(passwordInput, 'pass123');
    await user.click(submitButton);

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('L4: Network error (fetch rejects), handles failure gracefully', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Mock refresh
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(401, 'UNAUTHENTICATED')), { status: 401 }),
    );

    // Mock network error
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const { container } = renderApp({ initialRoute: '/login' });

    await vi.waitFor(() => {
      expect(useAuthStore.getState().status).toBe('anonymous');
    });

    const user = userEvent.setup();
    const emailInput = container.querySelector<HTMLInputElement>('#auth-identity')!;
    const passwordInput = container.querySelector<HTMLInputElement>('#auth-password')!;
    const submitButton = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    await user.type(emailInput, 'user@example.com');
    await user.type(passwordInput, 'pass123');
    await user.click(submitButton);

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(useAuthStore.getState().status).toBe('anonymous');
  });

  it('L5: CSRF token included in request headers when available', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    document.cookie = 'csrf_token=test-csrf-token; path=/';

    // Mock refresh
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(401, 'UNAUTHENTICATED')), { status: 401 }),
    );

    // Mock login
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(makeRefreshResponse({ accessToken: mockAccessToken, user: mockUser })),
        {
          status: 200,
        },
      ),
    );

    const { container } = renderApp({ initialRoute: '/login' });

    await vi.waitFor(() => {
      expect(useAuthStore.getState().status).toBe('anonymous');
    });

    const user = userEvent.setup();
    const emailInput = container.querySelector<HTMLInputElement>('#auth-identity')!;
    const passwordInput = container.querySelector<HTMLInputElement>('#auth-password')!;
    const submitButton = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    await user.type(emailInput, mockUser.email);
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await vi.waitFor(() => {
      expect(useAuthStore.getState().status).toBe('authenticated');
    });

    // Check login request (second call) has CSRF header
    const [, loginCallInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const loginCallHeaders = loginCallInit.headers as Record<string, string>;
    expect(loginCallHeaders['x-csrf-token']).toBe('test-csrf-token');
  });

  it('L6: After successful login, subsequent API calls include access token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Mock refresh
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(401, 'UNAUTHENTICATED')), { status: 401 }),
    );

    // Mock login
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(makeRefreshResponse({ accessToken: mockAccessToken, user: mockUser })),
        {
          status: 200,
        },
      ),
    );

    // Mock business API call
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { products: [] } }), { status: 200 }),
    );

    const { container } = renderApp({ initialRoute: '/login' });

    await vi.waitFor(() => {
      expect(useAuthStore.getState().status).toBe('anonymous');
    });

    const user = userEvent.setup();
    const emailInput = container.querySelector<HTMLInputElement>('#auth-identity')!;
    const passwordInput = container.querySelector<HTMLInputElement>('#auth-password')!;
    const submitButton = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    await user.type(emailInput, mockUser.email);
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await vi.waitFor(() => {
      expect(useAuthStore.getState().status).toBe('authenticated');
    });

    // Wait for mutation callbacks to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Trigger business API call
    const { apiClient } = await import('@/lib/http/client');
    await apiClient.get('/api/v1/products' as never);

    // Third call should include Authorization header
    const [, businessCallInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    const businessCallHeaders = businessCallInit.headers as Headers;
    expect(businessCallHeaders.get('authorization')).toBe(`Bearer ${mockAccessToken}`);
  });

  it('L7: Form submission triggers API call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // Mock refresh
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problem(401, 'UNAUTHENTICATED')), { status: 401 }),
    );

    // Mock login
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(makeRefreshResponse({ accessToken: mockAccessToken, user: mockUser })),
        {
          status: 200,
        },
      ),
    );

    const { container } = renderApp({ initialRoute: '/login' });

    await vi.waitFor(() => {
      expect(useAuthStore.getState().status).toBe('anonymous');
      expect(container.querySelector('#auth-identity')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const emailInput = container.querySelector<HTMLInputElement>('#auth-identity')!;
    const passwordInput = container.querySelector<HTMLInputElement>('#auth-password')!;
    const submitButton = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    await user.type(emailInput, mockUser.email);
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/login'),
        expect.anything(),
      );
    });
  });
});
