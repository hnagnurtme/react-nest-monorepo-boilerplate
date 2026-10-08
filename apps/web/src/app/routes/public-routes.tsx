import { lazy } from 'react';
import { Route } from 'react-router-dom';

import { PublicLayout } from '@/app/layouts/public-layout';

const LoginPage = lazy(() =>
  import('@/features/auth').then((module) => ({ default: module.LoginPage })),
);

const AcceptInvitationPage = lazy(() =>
  import('@/features/auth').then((module) => ({ default: module.AcceptInvitationPage })),
);

const SelectTenantPage = lazy(() =>
  import('@/features/auth').then((module) => ({ default: module.SelectTenantPage })),
);

const AcceptTenantInvitationPage = lazy(() =>
  import('@/features/users').then((module) => ({ default: module.AcceptTenantInvitationPage })),
);

const StatusPage = lazy(() =>
  import('@/features/status').then((module) => ({ default: module.StatusPage })),
);

/**
 * No session yet, so no shell: nothing to navigate and nobody to sign out.
 *
 * A function rather than a component: `<Routes>` reads its children as a route
 * description, so a component in between would be rendered instead of walked.
 */
export function publicRoutes(): React.ReactElement {
  return (
    <Route element={<PublicLayout />}>
      <Route path="/login" element={<LoginPage />} />
      {/* Reached from the invitation email, before any session exists. */}
      <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
      {/* Reached from the "you were invited to join" email. */}
      <Route path="/accept-tenant-invitation" element={<AcceptTenantInvitationPage />} />
      {/* Reached whenever an account has to say which tenant it is working in. */}
      <Route path="/select-tenant" element={<SelectTenantPage />} />
      {/*
        Deliberately outside the app shell and left public: a status page is
        worth most exactly when signing in is the thing that is broken.
      */}
      <Route path="/status" element={<StatusPage />} />
    </Route>
  );
}
