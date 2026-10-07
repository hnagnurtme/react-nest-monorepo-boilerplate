import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AbilityProvider } from '@/features/auth';
import { UsersPage } from '@/features/users';
import { ToastProvider } from '@/shared/ui';

import { makeUser, setSessionUser } from './fixtures/auth';

const TENANT_ID = '3f2b8c1e-5a4d-4c6e-9b7a-1d2e3f4a5b6c';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeFetch(createStatus = 201) {
  return vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation((url, init) => {
      if (init?.method === 'POST') {
        return Promise.resolve(
          createStatus === 201
            ? jsonResponse({ data: { id: 'new' } }, 201)
            : jsonResponse(
                { status: createStatus, code: 'CONFLICT', title: 'Conflict' },
                createStatus,
              ),
        );
      }
      if (url.includes('/api/v1/tenants')) {
        return Promise.resolve(
          jsonResponse({
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
          }),
        );
      }
      return Promise.resolve(
        jsonResponse({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
      );
    });
}

function renderUsers() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AbilityProvider>
          <MemoryRouter>
            <UsersPage />
          </MemoryRouter>
        </AbilityProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function postedBody(fetchMock: ReturnType<typeof makeFetch>): unknown {
  const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
  return JSON.parse(call?.[1]?.body as string);
}

async function fillCommon(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Full name'), 'Jane Doe');
  await user.type(screen.getByLabelText('Email'), 'jane@example.com');
  await user.type(screen.getByLabelText('Password'), 'supersecret1');
}

describe('CreateUserForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is hidden for tenant members', async () => {
    setSessionUser(makeUser({ role: 'TENANT_MEMBER' }));
    vi.stubGlobal('fetch', makeFetch());
    renderUsers();

    expect(await screen.findByText('No users found.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create user' })).not.toBeInTheDocument();
  });

  it('tenant admin: no tenant select, no platform role, omits tenantId and empty phone', async () => {
    setSessionUser(makeUser({ id: 'admin-1', role: 'TENANT_ADMIN', tenantId: 'tenant-1' }));
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);
    renderUsers();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Create user' }));
    expect(screen.queryByLabelText('Tenant')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Platform admin' })).not.toBeInTheDocument();

    await fillCommon(user);
    await user.selectOptions(screen.getByLabelText('Role'), 'TENANT_ADMIN');
    const submit = screen.getAllByRole('button', { name: 'Create user' }).at(-1);
    if (!submit) throw new Error('submit button missing');
    await user.click(submit);

    await waitFor(() => {
      expect(postedBody(fetchMock)).toEqual({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'supersecret1',
        role: 'TENANT_ADMIN',
      });
    });
  });

  it('platform admin: tenant select required for tenant roles, sent in payload', async () => {
    setSessionUser(makeUser({ id: 'root', role: 'PLATFORM_ADMIN', tenantId: undefined }));
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);
    renderUsers();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Create user' }));
    await fillCommon(user);
    await user.type(screen.getByLabelText('Phone (optional)'), '+84901234567');

    const submit = screen.getAllByRole('button', { name: 'Create user' }).at(-1);
    if (!submit) throw new Error('submit button missing');
    await user.click(submit);
    expect(await screen.findByText('Please select a tenant')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Tenant' }), 'Acme');
    await user.click(submit);

    await waitFor(() => {
      expect(postedBody(fetchMock)).toEqual({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phoneNumber: '+84901234567',
        password: 'supersecret1',
        role: 'TENANT_MEMBER',
        tenantId: TENANT_ID,
      });
    });
  });

  it('platform admin creating a PLATFORM_ADMIN hides the tenant select and omits tenantId', async () => {
    setSessionUser(makeUser({ id: 'root', role: 'PLATFORM_ADMIN', tenantId: undefined }));
    const fetchMock = makeFetch();
    vi.stubGlobal('fetch', fetchMock);
    renderUsers();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Create user' }));
    await fillCommon(user);
    await user.selectOptions(screen.getByLabelText('Role'), 'PLATFORM_ADMIN');
    expect(screen.queryByLabelText('Tenant')).not.toBeInTheDocument();

    const submit = screen.getAllByRole('button', { name: 'Create user' }).at(-1);
    if (!submit) throw new Error('submit button missing');
    await user.click(submit);

    await waitFor(() => {
      expect(postedBody(fetchMock)).toEqual({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'supersecret1',
        role: 'PLATFORM_ADMIN',
      });
    });
  });

  it('shows a duplicate-email message on 409', async () => {
    setSessionUser(makeUser({ id: 'admin-1', role: 'TENANT_ADMIN', tenantId: 'tenant-1' }));
    vi.stubGlobal('fetch', makeFetch(409));
    renderUsers();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Create user' }));
    await fillCommon(user);
    const submit = screen.getAllByRole('button', { name: 'Create user' }).at(-1);
    if (!submit) throw new Error('submit button missing');
    await user.click(submit);

    expect(await screen.findByText('A user with this email already exists.')).toBeInTheDocument();
  });
});
