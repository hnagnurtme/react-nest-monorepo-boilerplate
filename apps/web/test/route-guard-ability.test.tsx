import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { RouteGuard } from '@/app/components/route-guard';
import { useAuthStore } from '@/entities/session';
import { AbilityProvider } from '@/features/auth';

function ProtectedPage() {
  return <div data-testid="protected-page">Protected Content</div>;
}

function HomePage() {
  return <div data-testid="home-page">Home</div>;
}

function LoginPage() {
  return <div data-testid="login-page">Login</div>;
}

describe('Phase 2: RouteGuard with checkAbility (G1-G4)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'anonymous',
      accessToken: null,
      user: null,
    });
  });

  it('G0a: status=initializing → shows PageLoader', () => {
    useAuthStore.setState({
      status: 'initializing',
      accessToken: null,
      user: null,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <AbilityProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <RouteGuard>
                  <ProtectedPage />
                </RouteGuard>
              }
            />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AbilityProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByText((_, element) => element?.className.includes('animate-spin') ?? false),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
  });

  it('G0b: status=anonymous → redirects to /login', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <AbilityProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <RouteGuard>
                  <ProtectedPage />
                </RouteGuard>
              }
            />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AbilityProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
  });

  it('G0c: allowedRoles check fails → redirects to home', () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'token-member',
      user: {
        id: 'member-1',
        email: 'member@example.com',
        fullName: 'Member',
        role: 'TENANT_MEMBER',
      },
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AbilityProvider>
          <Routes>
            <Route
              path="/admin"
              element={
                <RouteGuard allowedRoles={['PLATFORM_ADMIN']}>
                  <ProtectedPage />
                </RouteGuard>
              }
            />
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AbilityProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
  });

  it('G1: checkAbility returns true → renders protected route', () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'token-admin',
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        fullName: 'Admin User',
        role: 'PLATFORM_ADMIN',
      },
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AbilityProvider>
          <Routes>
            <Route
              path="/admin"
              element={
                <RouteGuard checkAbility={(ability) => ability.can('manage', 'all')}>
                  <ProtectedPage />
                </RouteGuard>
              }
            />
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AbilityProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('protected-page')).toBeInTheDocument();
  });

  it('G2: checkAbility returns false → redirects to home', () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'token-member',
      user: {
        id: 'member-1',
        email: 'member@example.com',
        fullName: 'Member',
        role: 'TENANT_MEMBER',
      },
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AbilityProvider>
          <Routes>
            <Route
              path="/admin"
              element={
                <RouteGuard checkAbility={(ability) => ability.can('manage', 'all')}>
                  <ProtectedPage />
                </RouteGuard>
              }
            />
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AbilityProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
  });

  it('G3: both allowedRoles and checkAbility pass → renders protected route', () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'token-tadmin',
      user: {
        id: 'tenant-admin-1',
        email: 'tadmin@example.com',
        fullName: 'Tenant Admin',
        role: 'TENANT_ADMIN',
        tenantId: 't1',
      },
    });

    render(
      <MemoryRouter initialEntries={['/users']}>
        <AbilityProvider>
          <Routes>
            <Route
              path="/users"
              element={
                <RouteGuard
                  allowedRoles={['TENANT_ADMIN']}
                  checkAbility={(ability) => ability.can('create', 'User')}
                >
                  <ProtectedPage />
                </RouteGuard>
              }
            />
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AbilityProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('protected-page')).toBeInTheDocument();
  });

  it('G4: allowedRoles pass but checkAbility fails → redirects to home', () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'token-tadmin',
      user: {
        id: 'tenant-admin-1',
        email: 'tadmin@example.com',
        fullName: 'Tenant Admin',
        role: 'TENANT_ADMIN',
      },
    });

    render(
      <MemoryRouter initialEntries={['/users']}>
        <AbilityProvider>
          <Routes>
            <Route
              path="/users"
              element={
                <RouteGuard
                  allowedRoles={['TENANT_ADMIN']}
                  checkAbility={(ability) => ability.can('create', 'User')}
                >
                  <ProtectedPage />
                </RouteGuard>
              }
            />
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AbilityProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-page')).not.toBeInTheDocument();
  });
});
