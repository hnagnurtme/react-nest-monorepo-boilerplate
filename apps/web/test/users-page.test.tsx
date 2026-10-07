import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import '@/lib/i18n';

import { UsersPage } from '@/features/users';

function page(pageNumber: number): Response {
  return new Response(
    JSON.stringify({
      data: [
        {
          id: `user-${String(pageNumber)}`,
          email: `user${String(pageNumber)}@example.com`,
          fullName: `User ${String(pageNumber)}`,
          role: 'TENANT_MEMBER',
          tenantId: 't1',
          isActive: true,
        },
      ],
      meta: { page: pageNumber, limit: 20, total: 40, totalPages: 2 },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function renderPage(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <UsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('UsersPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists users and paginates via the page search param', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      return Promise.resolve(url.includes('page=2') ? page(2) : page(1));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage('/users');

    expect(await screen.findByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByText('Trang 1 / 2 (40 người dùng)')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sau' }));

    expect(await screen.findByText('user2@example.com')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('shows an error message when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ status: 403, code: 'FORBIDDEN' }), { status: 403 }),
        ),
    );

    renderPage('/users');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không thể tải danh sách người dùng.',
    );
  });
});
