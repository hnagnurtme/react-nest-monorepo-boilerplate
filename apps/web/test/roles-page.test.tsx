import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RouteGuard } from '@/app/components/route-guard';
import { RolesPage } from '@/features/roles';

import {
  jsonResponse,
  makePlatformAdmin,
  makeTenantAdmin,
  makeUser,
  MEMBER_GRANTS,
  PLATFORM_ADMIN_GRANTS,
  TENANT_ADMIN_GRANTS,
} from './fixtures/auth';
import { mockApi, renderWithProviders, type FetchHandler, type MockedFetch } from './providers';

const TENANT_ID = '3f2b8c1e-5a4d-4c6e-9b7a-1d2e3f4a5b6c';

const SYSTEM_ROLE = {
  id: '00000000-0000-4000-8000-000000000003',
  key: 'TENANT_MEMBER',
  name: 'Tenant member',
  scope: 'tenant',
  isSystem: true,
  tenantId: null,
  permissions: [{ action: 'read', subject: 'User', preset: 'own_tenant' }],
};
const CUSTOM_ROLE = {
  id: '22222222-2222-4222-8222-222222222222',
  key: 'SUPPORT',
  name: 'Support',
  scope: 'tenant',
  isSystem: false,
  tenantId: 'tenant-1',
  permissions: [{ action: 'read', subject: 'User', preset: 'own_record' }],
};
const OPTIONS = [
  {
    action: 'read',
    subject: 'User',
    description: 'View users',
    presets: ['own_tenant', 'own_record'],
  },
  { action: 'create', subject: 'User', description: 'Create users', presets: ['own_tenant'] },
  { action: 'read', subject: 'Role', description: 'View roles', presets: ['own_tenant'] },
];

function makeHandler(): FetchHandler {
  return (url, init) => {
    const { pathname } = new URL(url, 'http://localhost');
    const method = init?.method ?? 'GET';
    if (pathname === '/api/v1/permissions') return jsonResponse({ data: OPTIONS });
    if (pathname === '/api/v1/roles' && method === 'POST') {
      return jsonResponse({ data: CUSTOM_ROLE }, 201);
    }
    if (pathname === '/api/v1/roles') {
      return jsonResponse({
        data: [SYSTEM_ROLE, CUSTOM_ROLE],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      });
    }
    if (pathname.endsWith('/permissions')) return jsonResponse({ data: CUSTOM_ROLE });
    if (method === 'DELETE') return new Response(null, { status: 204 });
    if (pathname.endsWith(SYSTEM_ROLE.id)) return jsonResponse({ data: SYSTEM_ROLE });
    if (pathname.endsWith(CUSTOM_ROLE.id)) return jsonResponse({ data: CUSTOM_ROLE });
    if (pathname === '/api/v1/tenants') {
      return jsonResponse({
        data: [
          {
            id: TENANT_ID,
            name: 'Acme',
            slug: 'acme',
            isActive: true,
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
        meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });
    }
    return new Response(null, { status: 404 });
  };
}

function bodyOf(fetchMock: MockedFetch, method: string, pathPart: string): unknown {
  const call = fetchMock.mock.calls.find(
    ([url, init]) => init?.method === method && url.includes(pathPart),
  );
  return JSON.parse(call?.[1]?.body as string);
}

function renderRoles() {
  return renderWithProviders(
    <Routes>
      <Route
        path="/roles"
        element={
          <RouteGuard checkAbility={(ability) => ability.can('read', 'Role')}>
            <RolesPage />
          </RouteGuard>
        }
      />
      <Route path="/" element={<div data-testid="home">Home</div>} />
    </Routes>,
    ['/roles'],
  );
}

describe('RolesPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects users who cannot read roles', async () => {
    mockApi(makeUser(), MEMBER_GRANTS, makeHandler());
    renderRoles();

    expect(await screen.findByTestId('home')).toBeInTheDocument();
  });

  it('lists roles with system badge, scope and permission count', async () => {
    mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS, makeHandler());
    renderRoles();

    const systemRow = (await screen.findByText('Tenant member')).closest('tr');
    if (!systemRow) throw new Error('row missing');
    expect(within(systemRow).getByText('System')).toBeInTheDocument();
    expect(within(systemRow).getByText('TENANT_MEMBER')).toBeInTheDocument();
    expect(within(systemRow).getByText('Tenant')).toBeInTheDocument();
    expect(within(systemRow).getByText('1')).toBeInTheDocument();

    const customRow = screen.getByText('Support').closest('tr');
    if (!customRow) throw new Error('row missing');
    expect(within(customRow).queryByText('System')).not.toBeInTheDocument();
  });

  it('hides Create role without the create ability', async () => {
    const readOnly = TENANT_ADMIN_GRANTS.filter(
      (grant) => !(grant.subject === 'Role' && grant.action !== 'read'),
    );
    mockApi(makeTenantAdmin(), readOnly, makeHandler());
    renderRoles();

    expect(await screen.findByText('Support')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create role' })).not.toBeInTheDocument();
  });

  it('system roles are read-only: matrix disabled, no save, rename or delete', async () => {
    mockApi(makePlatformAdmin(), PLATFORM_ADMIN_GRANTS, makeHandler());
    renderRoles();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Open role Tenant member' }));
    const dialog = await screen.findByRole('dialog');
    const select = await within(dialog).findByLabelText('Read User');

    expect(select).toBeDisabled();
    expect(select).toHaveValue('own_tenant');
    expect(within(dialog).getByText('System roles are read-only.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Save permissions' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Delete role' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Rename' })).toBeNull();
  });

  it('saves the matrix selection via PUT /roles/:id/permissions', async () => {
    const fetchMock = mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS, makeHandler());
    renderRoles();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Open role Support' }));
    const dialog = await screen.findByRole('dialog');
    const read = await within(dialog).findByLabelText('Read User');
    expect(read).toHaveValue('own_record');
    // Only presets offered by the API (+ none) are selectable.
    expect(
      within(within(dialog).getByLabelText('Create User')).getAllByRole('option'),
    ).toHaveLength(2);

    await user.selectOptions(read, 'own_tenant');
    await user.selectOptions(within(dialog).getByLabelText('Create User'), 'own_tenant');
    await user.click(within(dialog).getByRole('button', { name: 'Save permissions' }));

    await waitFor(() => {
      expect(bodyOf(fetchMock, 'PUT', `${CUSTOM_ROLE.id}/permissions`)).toEqual({
        permissions: [
          { action: 'read', subject: 'User', preset: 'own_tenant' },
          { action: 'create', subject: 'User', preset: 'own_tenant' },
        ],
      });
    });
  });

  it('renames a custom role via PATCH', async () => {
    const fetchMock = mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS, makeHandler());
    renderRoles();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Open role Support' }));
    const dialog = await screen.findByRole('dialog');
    const input = await within(dialog).findByLabelText('Role name');
    await user.clear(input);
    await user.type(input, 'Helpdesk');
    await user.click(within(dialog).getByRole('button', { name: 'Rename' }));

    await waitFor(() => {
      expect(bodyOf(fetchMock, 'PATCH', CUSTOM_ROLE.id)).toEqual({ name: 'Helpdesk' });
    });
  });

  it('deletes a custom role after confirmation', async () => {
    const fetchMock = mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS, makeHandler());
    renderRoles();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Open role Support' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Delete role' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true);
    });
  });

  it('shows a conflict message when deleting a role that is still in use', async () => {
    const base = makeHandler();
    mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS, (url, init) =>
      init?.method === 'DELETE'
        ? jsonResponse({ status: 409, code: 'ROLE_IN_USE', title: 'Conflict' }, 409)
        : base(url, init),
    );
    renderRoles();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Open role Support' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Delete role' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText(/still assigned to users/)).toBeInTheDocument();
  });

  it('creates a role: tenant admin sends name + chosen permissions without tenantId', async () => {
    const fetchMock = mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS, makeHandler());
    renderRoles();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Create role' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText('Tenant')).not.toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Name'), 'Auditor');
    await user.selectOptions(await within(dialog).findByLabelText('Read Role'), 'own_tenant');
    await user.click(within(dialog).getByRole('button', { name: 'Create role' }));

    await waitFor(() => {
      expect(bodyOf(fetchMock, 'POST', '/api/v1/roles')).toEqual({
        name: 'Auditor',
        permissions: [{ action: 'read', subject: 'Role', preset: 'own_tenant' }],
      });
    });
  });

  it('platform admin must pick a tenant when creating a role', async () => {
    const fetchMock = mockApi(makePlatformAdmin(), PLATFORM_ADMIN_GRANTS, makeHandler());
    renderRoles();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Create role' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Auditor');
    await user.click(within(dialog).getByRole('button', { name: 'Create role' }));

    expect(await within(dialog).findByText('Please select a tenant')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);

    await user.selectOptions(await within(dialog).findByLabelText('Tenant'), 'Acme');
    await user.click(within(dialog).getByRole('button', { name: 'Create role' }));

    await waitFor(() => {
      expect(bodyOf(fetchMock, 'POST', '/api/v1/roles')).toEqual({
        name: 'Auditor',
        tenantId: TENANT_ID,
        permissions: [],
      });
    });
  });
});
