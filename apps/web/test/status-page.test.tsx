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

    const { findByRole } = renderApp({ initialRoute: '/status' });

    expect(await findByRole('status')).toHaveTextContent('Checking API status');
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
