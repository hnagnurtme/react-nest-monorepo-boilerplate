import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppLayout } from '@/app/layouts/app-layout';
import { useAuthStore } from '@/entities/session';

import {
  makePlatformAdmin,
  makeTenantAdmin,
  makeUser,
  MEMBER_GRANTS,
  PLATFORM_ADMIN_GRANTS,
  TENANT_ADMIN_GRANTS,
} from './fixtures/auth';
import { mockApi, renderWithProviders } from './providers';

function renderShell(entry: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<div data-testid="page">Home</div>} />
        <Route path="/users" element={<div data-testid="page">Users</div>} />
      </Route>
      <Route path="/select-tenant" element={<div data-testid="chooser">Choose</div>} />
    </Routes>,
    [entry],
  );
}

const TWO_TENANTS = [
  { id: 'tenant-1', name: 'Acme', slug: 'acme' },
  { id: 'tenant-2', name: 'Globex', slug: 'globex' },
];

async function openAccountMenu(): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
  return screen.getByRole('menu', { name: 'Account menu' });
}

function sidebar(): HTMLElement {
  // Two copies exist in the DOM at once only when the drawer is open; it is not.
  return screen.getByRole('navigation', { name: /navigation/i });
}

describe('the app shell', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'anonymous',
      accessToken: null,
      user: null,
      activeTenantId: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.localStorage.clear();
  });

  it('drops the entries the caller may not open, and the section once it is empty', async () => {
    mockApi(makeUser(), MEMBER_GRANTS);
    renderShell('/users?tenant=acme');

    expect(await screen.findByTestId('page')).toBeInTheDocument();
    // A member holds read:User, so the section stays — with Users and nothing else.
    expect(within(sidebar()).getByRole('link', { name: 'Users' })).toBeInTheDocument();
    expect(within(sidebar()).queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument();
    // No read:Role and no create:Tenant, so that whole section goes.
    expect(within(sidebar()).queryByText('Organisation')).not.toBeInTheDocument();
  });

  it('shows the access-control section to a tenant admin, and no tenants section', async () => {
    mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS);
    renderShell('/?tenant=acme');

    expect(await screen.findByTestId('page')).toBeInTheDocument();
    expect(within(sidebar()).getByText('Access control')).toBeInTheDocument();
    // `create:Tenant` is platform-only, which is what keeps the section hidden.
    expect(within(sidebar()).queryByText('Organisation')).not.toBeInTheDocument();
  });

  it('shows the organisation section to a platform admin', async () => {
    mockApi(makePlatformAdmin(), PLATFORM_ADMIN_GRANTS);
    renderShell('/');

    expect(await screen.findByTestId('page')).toBeInTheDocument();
    expect(within(sidebar()).getByText('Organisation')).toBeInTheDocument();
  });

  it('keeps the active tenant on every sidebar link', async () => {
    mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS);
    renderShell('/?tenant=acme');

    expect(await screen.findByTestId('page')).toBeInTheDocument();
    // The section has to be open for its items to be in the tree at all.
    const link = within(sidebar()).getByRole('link', { name: 'Home' });
    expect(link).toHaveAttribute('href', '/?tenant=acme');
  });

  it('leaves a platform account out of the tenant parameter', async () => {
    mockApi(makePlatformAdmin(), PLATFORM_ADMIN_GRANTS);
    renderShell('/');

    expect(await screen.findByTestId('page')).toBeInTheDocument();
    expect(within(sidebar()).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('marks the current page for assistive tech', async () => {
    mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS);
    renderShell('/users?tenant=acme');

    expect(await screen.findByTestId('page')).toBeInTheDocument();
    expect(within(sidebar()).getByRole('link', { name: 'Users' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('opens the section holding the current page, whatever was remembered', async () => {
    globalThis.localStorage.setItem('sidebar_open_sections', '[]');
    mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS);
    renderShell('/users?tenant=acme');

    expect(await screen.findByTestId('page')).toBeInTheDocument();
    expect(within(sidebar()).getByRole('link', { name: 'Users' })).toBeInTheDocument();
  });

  it('moves the tenant choice into the account menu', async () => {
    mockApi(makeTenantAdmin({ tenants: TWO_TENANTS }), TENANT_ADMIN_GRANTS);
    renderShell('/?tenant=acme');

    expect(await screen.findByTestId('page')).toBeInTheDocument();
    // The app bar no longer carries it: a control that throws away every cached
    // query does not belong next to the theme toggle.
    expect(screen.queryByRole('combobox', { name: /tenant/i })).not.toBeInTheDocument();

    const menu = await openAccountMenu();
    expect(within(menu).getByText('Workspace: Acme')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Switch workspace' })).toHaveAttribute(
      'href',
      '/select-tenant?change=1',
    );
  });

  it('offers no tenant switch to an account with one tenant', async () => {
    mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS);
    renderShell('/?tenant=acme');

    expect(await screen.findByTestId('page')).toBeInTheDocument();
    const menu = await openAccountMenu();

    expect(
      within(menu).queryByRole('menuitem', { name: 'Switch workspace' }),
    ).not.toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('reaches the chooser from the account menu', async () => {
    mockApi(makeTenantAdmin({ tenants: TWO_TENANTS }), TENANT_ADMIN_GRANTS);
    renderShell('/?tenant=acme');

    expect(await screen.findByTestId('page')).toBeInTheDocument();
    const menu = await openAccountMenu();
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Switch workspace' }));

    expect(await screen.findByTestId('chooser')).toBeInTheDocument();
  });
});
