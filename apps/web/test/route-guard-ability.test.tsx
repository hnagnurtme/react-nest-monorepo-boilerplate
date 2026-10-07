import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
            <Route path="/" element={<div data-testid="home-page">Home</div>} />
            <Route path="/login" element={<div data-testid="login-page">Login</div>} />
          </Routes>
        </AbilityProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const isSpinner = (_: string, element: Element | null): boolean =>
  element?.className.includes('animate-spin') ?? false;

describe('RouteGuard with abilities', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'anonymous', accessToken: null, user: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('status=initializing shows the PageLoader', () => {
    useAuthStore.setState({ status: 'initializing', accessToken: null, user: null });
    renderGuard();

    expect(screen.getByText(isSpinner)).toBeInTheDocument();
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

    expect(screen.getByText(isSpinner)).toBeInTheDocument();
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

    expect(await screen.findByTestId('home-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
  });

  it('without checkAbility an authenticated user is let through after the ability loaded', async () => {
    setSessionUser(makeUser());
    mockApi(makeUser(), MEMBER_GRANTS);
    renderGuard();

    expect(await screen.findByTestId('protected-page')).toBeInTheDocument();
  });
});
