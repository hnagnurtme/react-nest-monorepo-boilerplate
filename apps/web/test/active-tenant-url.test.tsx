import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RouteGuard } from '@/app/components/route-guard';
import { useAuthStore } from '@/entities/session';
import { AbilityProvider, TenantSwitcher, useActiveTenant } from '@/features/auth';

import { makeTenantAdmin, TENANT_ADMIN_GRANTS } from './fixtures/auth';
import { mockApi } from './providers';

const TWO_TENANTS = [
  { id: 'tenant-1', name: 'Acme', slug: 'acme' },
  { id: 'tenant-2', name: 'Globex', slug: 'globex' },
];

function Probe() {
  const location = useLocation();
  const { activeTenant } = useActiveTenant();
  return (
    <div>
      <span data-testid="search">{location.search}</span>
      <span data-testid="active">{activeTenant?.slug ?? 'none'}</span>
      <TenantSwitcher />
    </div>
  );
}

/**
 * The router sits outside the providers, as it does in `App`: a harness that
 * nests it inside one that unmounts while loading would remount the router and
 * silently restore the initial URL, hiding exactly what these tests check.
 */
function renderProbe(entry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <QueryClientProvider client={queryClient}>
        <AbilityProvider>
          <Routes>
            <Route
              path="/users"
              element={
                <RouteGuard>
                  <Probe />
                </RouteGuard>
              }
            />
            <Route path="/select-tenant" element={<div data-testid="select-tenant">Choose</div>} />
            <Route path="/login" element={<div data-testid="login">Login</div>} />
          </Routes>
        </AbilityProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('the tenant in the URL', () => {
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
  });

  it('acts in the tenant the URL names, not the remembered one', async () => {
    const user = makeTenantAdmin({ tenants: TWO_TENANTS });
    mockApi(user, TENANT_ADMIN_GRANTS);
    useAuthStore.setState({ activeTenantId: 'tenant-1' });
    renderProbe('/users?tenant=globex');

    expect(await screen.findByTestId('active')).toHaveTextContent('globex');
    expect(useAuthStore.getState().activeTenantId).toBe('tenant-2');
  });

  it('writes the remembered tenant into a URL that names none', async () => {
    const user = makeTenantAdmin({ tenants: TWO_TENANTS });
    mockApi(user, TENANT_ADMIN_GRANTS);
    useAuthStore.setState({ activeTenantId: 'tenant-2' });
    renderProbe('/users');

    expect(await screen.findByTestId('search')).toHaveTextContent('tenant=globex');
  });

  it('refuses a tenant the account does not belong to rather than substituting one', async () => {
    const user = makeTenantAdmin({ tenants: TWO_TENANTS });
    mockApi(user, TENANT_ADMIN_GRANTS);
    // A link from somebody else. Falling back to the remembered tenant here is
    // the bug this exists to prevent: Globex's rows under an Acme address.
    useAuthStore.setState({ activeTenantId: 'tenant-1' });
    renderProbe('/users?tenant=initech');

    expect(await screen.findByTestId('select-tenant')).toBeInTheDocument();
  });

  it('moves the URL when the switcher moves the tenant', async () => {
    const user = makeTenantAdmin({ tenants: TWO_TENANTS });
    mockApi(user, TENANT_ADMIN_GRANTS);
    useAuthStore.setState({ activeTenantId: 'tenant-1' });
    renderProbe('/users?tenant=acme');

    expect(await screen.findByTestId('active')).toHaveTextContent('acme');
    await userEvent.selectOptions(screen.getByRole('combobox'), 'tenant-2');

    expect(await screen.findByTestId('search')).toHaveTextContent('tenant=globex');
    expect(screen.getByTestId('active')).toHaveTextContent('globex');
  });
});
