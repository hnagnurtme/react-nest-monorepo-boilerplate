import { lazy } from 'react';
import { Route } from 'react-router-dom';

import { RouteGuard } from '@/app/components/route-guard';
import { AppLayout } from '@/app/layouts/app-layout';
import { guardFor } from '@/app/navigation/nav';

const HomePage = lazy(() =>
  import('@/features/home').then((module) => ({ default: module.HomePage })),
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

/**
 * Everything behind a session, inside the app shell. Each guard comes from the
 * navigation registry (`guardFor`), never from a predicate written out here.
 *
 * A function rather than a component: `<Routes>` reads its children as a route
 * description, so a component in between would be rendered instead of walked.
 */
export function appRoutes(): React.ReactElement {
  return (
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
  );
}
