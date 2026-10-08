import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UsersPage } from '@/features/users';

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
const OTHER_TENANT_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const ROLE_ADMIN = '00000000-0000-4000-8000-000000000002';
const ROLE_MEMBER = '00000000-0000-4000-8000-000000000003';
const ROLE_PLATFORM = '00000000-0000-4000-8000-000000000001';
const ROLE_OTHER_TENANT = '11111111-1111-4111-8111-111111111111';

function role(id: string, name: string, scope: 'platform' | 'tenant', tenantId: string | null) {
  return {
    id,
    key: name.toUpperCase(),
    name,
    scope,
    isSystem: tenantId === null,
    tenantId,
    permissions: [],
  };
}

function makeHandler(createStatus = 201): FetchHandler {
  return (url, init) => {
    if (init?.method === 'POST') {
      return createStatus === 201
        ? jsonResponse({ data: { id: 'new' } }, 201)
        : jsonResponse({ status: createStatus, code: 'CONFLICT', title: 'Conflict' }, createStatus);
    }
    if (url.includes('/api/v1/tenants')) {
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
    if (url.includes('/api/v1/roles')) {
      return jsonResponse({
        data: [
          role(ROLE_PLATFORM, 'Platform administrator', 'platform', null),
          role(ROLE_ADMIN, 'Tenant administrator', 'tenant', null),
          role(ROLE_MEMBER, 'Tenant member', 'tenant', null),
          role(ROLE_OTHER_TENANT, 'Other tenant custom', 'tenant', OTHER_TENANT_ID),
        ],
        meta: { page: 1, limit: 100, total: 4, totalPages: 1 },
      });
    }
    return jsonResponse({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  };
}

function postedBody(fetchMock: MockedFetch): unknown {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
  return JSON.parse(call?.[1]?.body as string);
}

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Create user' }));
}

/**
 * The form defaults to sending an invitation, which hides the password field.
 * These assertions are about tenant and role handling, so they opt out of it
 * and set the password directly.
 */
async function fillCommon(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Full name'), 'Jane Doe');
  await user.type(screen.getByLabelText('Email'), 'jane@example.com');
  await user.click(
    screen.getByLabelText('Email an invitation so the user sets their own password'),
  );
  await user.type(screen.getByLabelText('Password'), 'supersecret1');
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  const button = screen.getAllByRole('button', { name: 'Create user' }).at(-1);
  if (!button) throw new Error('submit button missing');
  await user.click(button);
}

describe('CreateUserForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is hidden for users who cannot create users', async () => {
    mockApi(makeUser(), MEMBER_GRANTS, makeHandler());
    renderWithProviders(<UsersPage />);

    expect(await screen.findByText('No users found.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create user' })).not.toBeInTheDocument();
  });

  it('invites by default: no password field, and the body carries no password', async () => {
    const fetchMock = mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS, makeHandler());
    renderWithProviders(<UsersPage />);
    const user = userEvent.setup();

    await openForm(user);
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Full name'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email'), 'jane@example.com');
    await user.click(await screen.findByLabelText('Tenant member'));
    await submit(user);

    await waitFor(() => {
      expect(postedBody(fetchMock)).toEqual({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        roleIds: [ROLE_MEMBER],
      });
    });
  });

  it('requires at least one role', async () => {
    const fetchMock = mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS, makeHandler());
    renderWithProviders(<UsersPage />);
    const user = userEvent.setup();

    await openForm(user);
    await fillCommon(user);
    await submit(user);

    expect(await screen.findByText('Select at least one role')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('tenant admin: no tenant select, sends roleIds, omits tenantId and empty phone', async () => {
    const fetchMock = mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS, makeHandler());
    renderWithProviders(<UsersPage />);
    const user = userEvent.setup();

    await openForm(user);
    expect(screen.queryByLabelText('Tenant')).not.toBeInTheDocument();

    await fillCommon(user);
    await user.click(await screen.findByLabelText('Tenant administrator'));
    await user.click(screen.getByLabelText('Tenant member'));
    await submit(user);

    await waitFor(() => {
      expect(postedBody(fetchMock)).toEqual({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'supersecret1',
        roleIds: [ROLE_ADMIN, ROLE_MEMBER],
      });
    });
  });

  it('platform admin: tenant required for tenant roles and sent; other tenants roles hidden', async () => {
    const fetchMock = mockApi(makePlatformAdmin(), PLATFORM_ADMIN_GRANTS, makeHandler());
    renderWithProviders(<UsersPage />);
    const user = userEvent.setup();

    await openForm(user);
    await fillCommon(user);
    await user.type(screen.getByLabelText('Phone (optional)'), '+84901234567');
    await user.click(await screen.findByLabelText('Tenant member'));

    await submit(user);
    expect(await screen.findByText('Please select a tenant')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Tenant' }), 'Acme');
    expect(screen.queryByLabelText('Other tenant custom')).not.toBeInTheDocument();
    await submit(user);

    await waitFor(() => {
      expect(postedBody(fetchMock)).toEqual({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phoneNumber: '+84901234567',
        password: 'supersecret1',
        roleIds: [ROLE_MEMBER],
        tenantId: TENANT_ID,
      });
    });
  });

  it('platform admin picking only a platform role hides the tenant select and omits tenantId', async () => {
    const fetchMock = mockApi(makePlatformAdmin(), PLATFORM_ADMIN_GRANTS, makeHandler());
    renderWithProviders(<UsersPage />);
    const user = userEvent.setup();

    await openForm(user);
    await fillCommon(user);
    await user.click(await screen.findByLabelText('Platform administrator'));
    expect(screen.queryByLabelText('Tenant')).not.toBeInTheDocument();
    await submit(user);

    await waitFor(() => {
      expect(postedBody(fetchMock)).toEqual({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'supersecret1',
        roleIds: [ROLE_PLATFORM],
      });
    });
  });

  it('rejects mixing a platform role with a tenant role', async () => {
    mockApi(makePlatformAdmin(), PLATFORM_ADMIN_GRANTS, makeHandler());
    renderWithProviders(<UsersPage />);
    const user = userEvent.setup();

    await openForm(user);
    await fillCommon(user);
    await user.click(await screen.findByLabelText('Platform administrator'));
    await user.click(screen.getByLabelText('Tenant member'));
    await submit(user);

    expect(await screen.findByText('Do not mix platform and tenant roles')).toBeInTheDocument();
  });

  it('shows a duplicate-email message on 409', async () => {
    mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS, makeHandler(409));
    renderWithProviders(<UsersPage />);
    const user = userEvent.setup();

    await openForm(user);
    await fillCommon(user);
    await user.click(await screen.findByLabelText('Tenant member'));
    await submit(user);

    expect(await screen.findByText('A user with this email already exists.')).toBeInTheDocument();
  });
});
