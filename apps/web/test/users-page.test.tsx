import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UsersPage } from '@/features/users';
import { formatDate } from '@/lib/i18n/format';

import {
  jsonResponse,
  makePlatformAdmin,
  makeTenantAdmin,
  makeUser,
  MEMBER_GRANTS,
  PLATFORM_ADMIN_GRANTS,
  TENANT_ADMIN_GRANTS,
} from './fixtures/auth';
import { mockApi, renderWithProviders, type FetchHandler } from './providers';

const MEMBER_ROLE = {
  id: '00000000-0000-4000-8000-000000000003',
  key: 'TENANT_MEMBER',
  name: 'Tenant member',
};
const ADMIN_ROLE = {
  id: '00000000-0000-4000-8000-000000000002',
  key: 'TENANT_ADMIN',
  name: 'Tenant administrator',
};

function roleRow(role: { id: string; key: string; name: string }) {
  return {
    ...role,
    scope: 'tenant',
    isSystem: true,
    tenantId: null,
    permissions: [],
  };
}

function page(pageNumber: number, overrides: Record<string, unknown> = {}): Response {
  return jsonResponse({
    data: [
      {
        id: `user-${String(pageNumber)}`,
        email: `user${String(pageNumber)}@example.com`,
        fullName: `User ${String(pageNumber)}`,
        phoneNumber: null,
        roles: [MEMBER_ROLE],
        tenantId: 'tenant-1',
        isActive: true,
        isEmailVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
      },
    ],
    meta: { page: pageNumber, limit: 20, total: 40, totalPages: 2 },
  });
}

/** Same list, but the only row is an invited account that never accepted. */
const pendingInviteHandler: FetchHandler = (url, init) => {
  if (init?.method === 'POST' && url.includes('/resend-invitation')) {
    return new Response(null, { status: 204 });
  }
  if (url.includes('/api/v1/roles')) return listHandler(url, init);
  return page(1, { isEmailVerified: false });
};

const listHandler: FetchHandler = (url, init) => {
  if (init?.method === 'DELETE') return new Response(null, { status: 204 });
  if (init?.method === 'PATCH' || init?.method === 'PUT') return jsonResponse({ data: {} });
  if (url.includes('/api/v1/roles')) {
    return jsonResponse({
      data: [roleRow(MEMBER_ROLE), roleRow(ADMIN_ROLE)],
      meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
    });
  }
  // A search for a term no row matches comes back empty, like the API would.
  if (url.includes('search=zzz')) {
    return jsonResponse({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  }
  return url.includes('page=2') ? page(2) : page(1);
};

describe('UsersPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists users with their role names and paginates via the page search param', async () => {
    const fetchMock = mockApi(makeUser(), MEMBER_GRANTS, listHandler);
    renderWithProviders(<UsersPage />, ['/users']);

    expect(await screen.findByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByText('Tenant member')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2 (40 users)')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('user2@example.com')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => url.includes('page=2'))).toBe(true);
    });
  });

  it('formats the created date for the active locale', async () => {
    mockApi(makeUser(), MEMBER_GRANTS, listHandler);
    renderWithProviders(<UsersPage />, ['/users']);

    expect(await screen.findByText('user1@example.com')).toBeInTheDocument();
    // Asserted through the same formatter: a literal would break outside UTC.
    expect(screen.getByText(formatDate('2026-01-01T00:00:00.000Z', 'en'))).toBeInTheDocument();
  });

  it('sends a debounced search term, drops the page and reports no match', async () => {
    const fetchMock = mockApi(makeUser(), MEMBER_GRANTS, listHandler);
    renderWithProviders(<UsersPage />, ['/users?page=2']);
    const user = userEvent.setup();

    expect(await screen.findByText('user2@example.com')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search users'), 'zzz');

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => url.includes('search=zzz'))).toBe(true);
    });
    // One request per settled term, not one per keystroke.
    expect(fetchMock.mock.calls.filter(([url]) => url.includes('search=')).length).toBe(1);
    // Page 2 of the old result set is meaningless, so the term resets to page 1.
    expect(
      fetchMock.mock.calls.some(([url]) => url.includes('search=') && url.includes('page=2')),
    ).toBe(false);

    expect(await screen.findByText('No user matches "zzz".')).toBeInTheDocument();
  });

  it('clearing the search box restores the unfiltered list', async () => {
    mockApi(makeUser(), MEMBER_GRANTS, listHandler);
    renderWithProviders(<UsersPage />, ['/users?q=zzz']);
    const user = userEvent.setup();

    expect(await screen.findByText('No user matches "zzz".')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(await screen.findByText('user1@example.com')).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    mockApi(makeUser(), MEMBER_GRANTS, () => jsonResponse({ status: 403, code: 'FORBIDDEN' }, 403));
    renderWithProviders(<UsersPage />, ['/users']);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load users.');
  });

  it('hides create/row actions from members', async () => {
    mockApi(makeUser(), MEMBER_GRANTS, listHandler);
    renderWithProviders(<UsersPage />, ['/users']);

    expect(await screen.findByText('user1@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create user' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit roles' })).not.toBeInTheDocument();
  });

  it('shows no row actions on the current user own row', async () => {
    mockApi(makeTenantAdmin({ id: 'user-1' }), TENANT_ADMIN_GRANTS, listHandler);
    renderWithProviders(<UsersPage />, ['/users']);

    expect(await screen.findByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create user' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit roles' })).not.toBeInTheDocument();
  });

  it('hides Edit roles for a tenant admin on a user of another tenant', async () => {
    mockApi(makeTenantAdmin({ tenantId: 'tenant-2' }), TENANT_ADMIN_GRANTS, listHandler);
    renderWithProviders(<UsersPage />, ['/users']);

    expect(await screen.findByText('user1@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit roles' })).not.toBeInTheDocument();
  });

  it('lets a tenant admin deactivate and delete another user in their tenant', async () => {
    const fetchMock = mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS, listHandler);
    renderWithProviders(<UsersPage />, ['/users']);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Deactivate' }));
    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(patch?.[0]).toContain('/api/v1/users/user-1');
      expect(JSON.parse(patch?.[1]?.body as string)).toEqual({ isActive: false });
    });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true);
    });
  });

  it('edits the roles of another user via PUT /users/:id/roles', async () => {
    const fetchMock = mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS, listHandler);
    renderWithProviders(<UsersPage />, ['/users']);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Edit roles' }));
    const dialog = await screen.findByRole('dialog');
    const member = await screen.findByLabelText('Tenant member', { selector: 'input' });
    expect(member).toBeChecked();

    await user.click(screen.getByLabelText('Tenant administrator'));
    await user.click(screen.getByRole('button', { name: 'Save roles' }));

    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(put?.[0]).toContain('/api/v1/users/user-1/roles');
      expect(JSON.parse(put?.[1]?.body as string)).toEqual({
        roleIds: [MEMBER_ROLE.id, ADMIN_ROLE.id],
      });
    });
    await waitFor(() => {
      expect(dialog).not.toBeInTheDocument();
    });
  });

  it('marks an unaccepted invitation and resends it via POST /users/:id/resend-invitation', async () => {
    const fetchMock = mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS, pendingInviteHandler);
    renderWithProviders(<UsersPage />, ['/users']);

    expect(await screen.findByText('Invitation pending')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Resend invitation' }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
      expect(post?.[0]).toContain('/api/v1/users/user-1/resend-invitation');
    });
    expect(await screen.findByText('Invitation sent to user1@example.com.')).toBeInTheDocument();
  });

  it('offers no resend action on an account that already accepted', async () => {
    mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS, listHandler);
    renderWithProviders(<UsersPage />, ['/users']);

    expect(await screen.findByText('user1@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Invitation pending')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resend invitation' })).not.toBeInTheDocument();
  });

  it('platform admins can edit roles of users anywhere', async () => {
    mockApi(makePlatformAdmin(), PLATFORM_ADMIN_GRANTS, listHandler);
    renderWithProviders(<UsersPage />, ['/users']);

    expect(await screen.findByRole('button', { name: 'Edit roles' })).toBeInTheDocument();
  });
});
