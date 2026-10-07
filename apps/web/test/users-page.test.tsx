import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AbilityProvider } from '@/features/auth';
import { UsersPage } from '@/features/users';
import { ToastProvider } from '@/shared/ui';

import { makeUser, setSessionUser } from './fixtures/auth';

function page(pageNumber: number): Response {
  return new Response(
    JSON.stringify({
      data: [
        {
          id: `user-${String(pageNumber)}`,
          email: `user${String(pageNumber)}@example.com`,
          fullName: `User ${String(pageNumber)}`,
          phoneNumber: null,
          role: 'TENANT_MEMBER',
          tenantId: 'tenant-1',
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      meta: { page: pageNumber, limit: 20, total: 40, totalPages: 2 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function renderPage(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AbilityProvider>
          <MemoryRouter initialEntries={[initialEntry]}>
            <UsersPage />
          </MemoryRouter>
        </AbilityProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('UsersPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists users and paginates via the page search param', async () => {
    setSessionUser(makeUser());
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      return Promise.resolve(url.includes('page=2') ? page(2) : page(1));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage('/users');

    expect(await screen.findByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2 (40 users)')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('user2@example.com')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('shows an error message when the request fails', async () => {
    setSessionUser(makeUser());
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ status: 403, code: 'FORBIDDEN' }), { status: 403 }),
        ),
    );

    renderPage('/users');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load users.');
  });

  it('hides create/row actions from members and never shows actions on the own row', async () => {
    setSessionUser(makeUser());
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(page(1))),
    );

    renderPage('/users');

    expect(await screen.findByText('user1@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create user' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
  });

  it('shows row actions to tenant admins, but not on their own row', async () => {
    setSessionUser(makeUser({ id: 'user-1', role: 'TENANT_ADMIN', tenantId: 'tenant-1' }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(page(1))),
    );

    renderPage('/users');

    expect(await screen.findByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create user' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('lets a tenant admin deactivate and delete another user in their tenant', async () => {
    setSessionUser(makeUser({ id: 'admin-1', role: 'TENANT_ADMIN', tenantId: 'tenant-1' }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = vi
      .fn<(url: string, init?: RequestInit) => Promise<Response>>()
      .mockImplementation((_url, init) => {
        if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
        if (init?.method === 'PATCH') {
          return Promise.resolve(new Response(JSON.stringify({ data: {} }), { status: 200 }));
        }
        return Promise.resolve(page(1));
      });
    vi.stubGlobal('fetch', fetchMock);

    renderPage('/users');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Deactivate' }));
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(patch?.[0]).toContain('/api/v1/users/user-1');
      expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ isActive: false });
    });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true);
    });
  });
});
