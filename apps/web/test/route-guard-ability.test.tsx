import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppAbility } from '@repo/shared-types';

import { RouteGuard } from '@/app/components/route-guard';
import { useAuthStore } from '@/entities/session';
import { AbilityProvider } from '@/features/auth';

import {
  makePlatformAdmin,
  makeUser,
  MEMBER_GRANTS,
  PLATFORM_ADMIN_GRANTS,
  setSessionUser,
} from './fixtures/auth';
import { mockApi } from './providers';

function ProtectedPage() {
  return <div data-testid="protected-page">Protected Content</div>;
}

function HomeProbe() {
  const location = useLocation();
  const denied = (location.state as { accessDenied?: boolean } | null)?.accessDenied === true;
  return <div data-testid="home-page">{denied ? 'denied' : 'Home'}</div>;
}

const canManageAll = (ability: AppAbility): boolean => ability.can('manage', 'all');

function renderGuard(checkAbility?: (ability: AppAbility) => boolean, initialEntry = '/protected') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AbilityProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <RouteGuard {...(checkAbility ? { checkAbility } : {})}>
                  <ProtectedPage />
                </RouteGuard>
              }
            />
            <Route path="/" element={<HomeProbe />} />
            <Route path="/login" element={<div data-testid="login-page">Login</div>} />
            <Route
              path="/select-tenant"
              element={<div data-testid="select-tenant-page">Choose</div>}
            />
          </Routes>
        </AbilityProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RouteGuard with abilities', () => {
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

  it('status=initializing shows the PageLoader', () => {
    useAuthStore.setState({ status: 'initializing', accessToken: null, user: null });
    renderGuard();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
  });

  it('status=anonymous redirects to /login', () => {
    renderGuard();

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
  });

  it('shows the loader (no redirect) while the ability is loading, then renders', async () => {
    mockApi(makePlatformAdmin(), PLATFORM_ADMIN_GRANTS);
    renderGuard(canManageAll);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();

    expect(await screen.findByTestId('protected-page')).toBeInTheDocument();
  });

  it('checkAbility true renders the protected route', async () => {
    mockApi(makePlatformAdmin(), PLATFORM_ADMIN_GRANTS);
    renderGuard(canManageAll);

    expect(await screen.findByTestId('protected-page')).toBeInTheDocument();
  });

  it('checkAbility false redirects to home once the ability has loaded', async () => {
    mockApi(makeUser(), MEMBER_GRANTS);
    renderGuard(canManageAll);

    expect(await screen.findByTestId('home-page')).toHaveTextContent('denied');
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
  });

  it('without checkAbility an authenticated user is let through after the ability loaded', async () => {
    setSessionUser(makeUser());
    mockApi(makeUser(), MEMBER_GRANTS);
    renderGuard();

    expect(await screen.findByTestId('protected-page')).toBeInTheDocument();
  });

  it('sends an account with several tenants to the picker before anything loads', async () => {
    mockApi(makeUser(), MEMBER_GRANTS);
    setSessionUser(
      makeUser({
        tenants: [
          { id: 'tenant-1', name: 'Acme', slug: 'acme' },
          { id: 'tenant-2', name: 'Globex', slug: 'globex' },
        ],
      }),
    );
    renderGuard();

    expect(await screen.findByTestId('select-tenant-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
  });

  it('lets a platform user through without any tenant', async () => {
    setSessionUser(makePlatformAdmin());
    mockApi(makePlatformAdmin(), PLATFORM_ADMIN_GRANTS);
    renderGuard();

    expect(await screen.findByTestId('protected-page')).toBeInTheDocument();
  });
});
