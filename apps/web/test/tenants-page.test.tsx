import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RouteGuard } from '@/app/components/route-guard';
import { useAuthStore } from '@/entities/session';
import { TenantsPage } from '@/features/tenants';

import {
  jsonResponse,
  makePlatformAdmin,
  makeTenantAdmin,
  PLATFORM_ADMIN_GRANTS,
  TENANT_ADMIN_GRANTS,
} from './fixtures/auth';
import { mockApi, renderWithProviders } from './providers';

function renderRoute() {
  return renderWithProviders(
    <Routes>
      <Route
        path="/tenants"
        element={
          <RouteGuard checkAbility={(ability) => ability.can('create', 'Tenant')}>
            <TenantsPage />
          </RouteGuard>
        }
      />
      <Route path="/" element={<div data-testid="home">Home</div>} />
      <Route path="/login" element={<div data-testid="login">Login</div>} />
    </Routes>,
    ['/tenants'],
  );
}

describe('TenantsPage route guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects tenant admins to home', async () => {
    mockApi(makeTenantAdmin(), TENANT_ADMIN_GRANTS);
    renderRoute();
    expect(await screen.findByTestId('home')).toBeInTheDocument();
  });

  it('redirects anonymous users to login', () => {
    useAuthStore.setState({ status: 'anonymous', accessToken: null, user: null });
    renderRoute();
    expect(screen.getByTestId('login')).toBeInTheDocument();
  });

  it('lets platform admins see the tenants list and create form', async () => {
    mockApi(makePlatformAdmin(), PLATFORM_ADMIN_GRANTS, () =>
      jsonResponse({
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
    );
    renderRoute();

    expect(await screen.findByText('acme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create tenant' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
  });
});
