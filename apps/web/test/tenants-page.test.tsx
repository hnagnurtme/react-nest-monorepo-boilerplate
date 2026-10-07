import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RouteGuard } from '@/app/components/route-guard';
import { useAuthStore } from '@/entities/session';
import { AbilityProvider } from '@/features/auth';
import { TenantsPage } from '@/features/tenants';
import { ToastProvider } from '@/shared/ui';

import { makeUser, setSessionUser } from './fixtures/auth';

function renderRoute() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AbilityProvider>
          <MemoryRouter initialEntries={['/tenants']}>
            <Routes>
              <Route
                path="/tenants"
                element={
                  <RouteGuard allowedRoles={['PLATFORM_ADMIN']}>
                    <TenantsPage />
                  </RouteGuard>
                }
              />
              <Route path="/" element={<div data-testid="home">Home</div>} />
              <Route path="/login" element={<div data-testid="login">Login</div>} />
            </Routes>
          </MemoryRouter>
        </AbilityProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('TenantsPage route guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects tenant admins to home', () => {
    setSessionUser(makeUser({ role: 'TENANT_ADMIN' }));
    renderRoute();
    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('redirects anonymous users to login', () => {
    useAuthStore.setState({ status: 'anonymous', accessToken: null, user: null });
    renderRoute();
    expect(screen.getByTestId('login')).toBeInTheDocument();
  });

  it('lets platform admins see the tenants list and create form', async () => {
    setSessionUser(makeUser({ id: 'root', role: 'PLATFORM_ADMIN', tenantId: undefined }));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 't1',
                name: 'Acme',
                slug: 'acme',
                isActive: true,
                createdAt: '2026-01-01T00:00:00Z',
              },
            ],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    renderRoute();

    expect(await screen.findByText('acme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create tenant' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
  });
});
