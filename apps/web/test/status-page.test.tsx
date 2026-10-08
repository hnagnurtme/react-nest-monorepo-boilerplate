import { describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/entities/session';

import { renderApp } from './utils/render-app';

describe('status page', () => {
  it('shows a loading state while the health request is pending', async () => {
    useAuthStore.setState({ status: 'anonymous', accessToken: null, user: null });

    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    // Not `findByRole('status')`: the route's Suspense fallback is a live region
    // too, so the assertion has to name the page's own message.
    const { findByText } = renderApp({ initialRoute: '/status' });

    expect(await findByText('Checking API status')).toBeInTheDocument();
  });

  it('shows a healthy API state', async () => {
    useAuthStore.setState({ status: 'anonymous', accessToken: null, user: null });

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ data: { service: 'api', status: 'ok' } })),
        ),
    );

    const { findByText } = renderApp({ initialRoute: '/status' });

    expect(await findByText('API is healthy')).toBeInTheDocument();
  });

  it('shows an error state when the API cannot be reached', async () => {
    useAuthStore.setState({ status: 'anonymous', accessToken: null, user: null });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { findByText } = renderApp({ initialRoute: '/status' });

    expect(await findByText('API is unavailable')).toBeInTheDocument();
  });
});
