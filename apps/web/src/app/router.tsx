import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import type { AppAbility } from '@repo/shared-types';

import { PageLoader } from '@/shared/ui';

import { ErrorBoundary } from './components/error-boundary';
import { RouteGuard } from './components/route-guard';
import { AppLayout } from './layouts/app-layout';
import { PublicLayout } from './layouts/public-layout';
import { isLeafAllowed, NAV } from './navigation/nav';

const HomePage = lazy(() =>
  import('@/features/home').then((module) => ({ default: module.HomePage })),
);

const LoginPage = lazy(() =>
  import('@/features/auth').then((module) => ({ default: module.LoginPage })),
);

const AcceptInvitationPage = lazy(() =>
  import('@/features/auth').then((module) => ({ default: module.AcceptInvitationPage })),
);

const SelectTenantPage = lazy(() =>
  import('@/features/auth').then((module) => ({ default: module.SelectTenantPage })),
);

const StatusPage = lazy(() =>
  import('@/features/status').then((module) => ({ default: module.StatusPage })),
);

const UsersPage = lazy(() =>
  import('@/features/users').then((module) => ({ default: module.UsersPage })),
);

const AcceptTenantInvitationPage = lazy(() =>
  import('@/features/users').then((module) => ({ default: module.AcceptTenantInvitationPage })),
);

const RolesPage = lazy(() =>
  import('@/features/roles').then((module) => ({ default: module.RolesPage })),
);

const TenantsPage = lazy(() =>
  import('@/features/tenants').then((module) => ({ default: module.TenantsPage })),
);

/**
 * The ability check for a guarded page comes from the navigation registry, so
 * the sidebar and the guard can never disagree about who may open it. Adding a
 * page means adding one entry there, not an entry here and a predicate too.
 */
function guardFor(path: string): ((ability: AppAbility) => boolean) | undefined {
  const leaf = NAV.flatMap((section) => section.children).find((entry) => entry.path === path);
  if (leaf?.can === undefined) return undefined;
  return (ability: AppAbility) => isLeafAllowed(leaf, ability);
}

export function AppRouter() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* No session yet, so no shell: nothing to navigate and nobody to sign out. */}
          <Route element={<PublicLayout />}>
            <Route path="/login" element={<LoginPage />} />
            {/* Reached from the invitation email, before any session exists. */}
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
            {/* Reached from the "you were invited to join" email. */}
            <Route path="/accept-tenant-invitation" element={<AcceptTenantInvitationPage />} />
            {/* Reached whenever an account has to say which tenant it is working in. */}
            <Route path="/select-tenant" element={<SelectTenantPage />} />
            {/*
              Deliberately outside the app shell and left public: a status page
              is worth most exactly when signing in is the thing that is broken.
            */}
            <Route path="/status" element={<StatusPage />} />
          </Route>

          <Route element={<AppLayout />}>
            <Route
              path="/"
              element={
                <RouteGuard>
                  <HomePage />
                </RouteGuard>
              }
            />
            <Route
              path="/users"
              element={
                <RouteGuard checkAbility={guardFor('/users')}>
                  <UsersPage />
                </RouteGuard>
              }
            />
            <Route
              path="/roles"
              element={
                <RouteGuard checkAbility={guardFor('/roles')}>
                  <RolesPage />
                </RouteGuard>
              }
            />
            <Route
              path="/tenants"
              element={
                <RouteGuard checkAbility={guardFor('/tenants')}>
                  <TenantsPage />
                </RouteGuard>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
