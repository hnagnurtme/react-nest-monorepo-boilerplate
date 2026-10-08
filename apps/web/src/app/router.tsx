import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import type { AppAbility } from '@repo/shared-types';

import { ErrorBoundary } from './components/error-boundary';
import { PageLoader } from './components/page-loader';
import { RouteGuard } from './components/route-guard';

const HomePage = lazy(() =>
  import('@/features/home').then((module) => ({ default: module.HomePage })),
);

const LoginPage = lazy(() =>
  import('@/features/auth').then((module) => ({ default: module.LoginPage })),
);

const AcceptInvitationPage = lazy(() =>
  import('@/features/auth').then((module) => ({ default: module.AcceptInvitationPage })),
);

const StatusPage = lazy(() =>
  import('@/features/status').then((module) => ({ default: module.StatusPage })),
);

const UsersPage = lazy(() =>
  import('@/features/users').then((module) => ({ default: module.UsersPage })),
);

const RolesPage = lazy(() =>
  import('@/features/roles').then((module) => ({ default: module.RolesPage })),
);

const TenantsPage = lazy(() =>
  import('@/features/tenants').then((module) => ({ default: module.TenantsPage })),
);

// Route access is decided by the CASL ability from @repo/shared-types, the same
// source the API enforces, so a role change is made once and not per route.
const canReadUsers = (ability: AppAbility): boolean => ability.can('read', 'User');
const canReadRoles = (ability: AppAbility): boolean => ability.can('read', 'Role');
// Only a platform admin may create tenants; tenant admins can merely read/update their own.
const canManageTenants = (ability: AppAbility): boolean => ability.can('create', 'Tenant');

export function AppRouter() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          {/* Public: reached from the invitation email, before any session exists. */}
          <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route
            path="/users"
            element={
              <RouteGuard checkAbility={canReadUsers}>
                <UsersPage />
              </RouteGuard>
            }
          />
          <Route
            path="/roles"
            element={
              <RouteGuard checkAbility={canReadRoles}>
                <RolesPage />
              </RouteGuard>
            }
          />
          <Route
            path="/tenants"
            element={
              <RouteGuard checkAbility={canManageTenants}>
                <TenantsPage />
              </RouteGuard>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
