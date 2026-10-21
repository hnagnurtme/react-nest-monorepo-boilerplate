import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import type { AppAbility } from '@repo/shared-types';

import { useAuthStore } from '@/entities/session';
import { useAbility, useAbilityLoading, useActiveTenant } from '@/features/auth';
import { PageLoader } from '@/shared/ui';

interface RouteGuardProps {
  checkAbility?: ((ability: AppAbility) => boolean) | undefined;
  /**
   * This page works without a tenant chosen **for a platform account**: the
   * chooser itself (that account's home page) and the platform pages that are
   * about tenants rather than inside one, which the API marks `@PlatformWide`.
   *
   * It is scope-specific on purpose. A platform caller with no choice runs in
   * `admin` mode, so those requests answer; a tenant caller sends no
   * `x-tenant-id` at all and every request on the page is a `401 Missing
   * x-tenant-id header` — including the app bar's notification poll, which is
   * mounted on each of these pages. So a tenant account is still sent to choose
   * first, everywhere.
   */
  allowsNoTenant?: boolean;
  children: ReactNode;
}

export function RouteGuard({
  checkAbility,
  allowsNoTenant = false,
  children,
}: RouteGuardProps): React.ReactNode {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const ability = useAbility();
  const isAbilityLoading = useAbilityLoading();
  const { isChoicePending, isResolving } = useActiveTenant();

  // Wait for session initialization
  if (status === 'initializing') {
    return <PageLoader />;
  }

  // Redirect to login if not authenticated
  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // A platform account's tenants come from a request. Until it answers the
  // choice is neither made nor missing, and treating it as missing would bounce
  // every reload to the chooser. A page that needs no tenant does not wait.
  if (isResolving && !allowsNoTenant) {
    return <PageLoader />;
  }

  // Nothing tenant-scoped can load before the account says which tenant it is
  // working in — the API rejects such a request rather than picking one.
  if (isChoicePending && !(allowsNoTenant && user.scope === 'platform')) {
    /*
      A platform account chooses on its own home page, which is the chooser; a
      tenant account has the standalone screen, because for it the whole app is
      behind the choice and there is no home page to show instead.
    */
    const to = user.scope === 'platform' ? '/' : '/select-tenant';
    return <Navigate to={to} state={{ from: location }} replace />;
  }

  // The ability comes from the API: wait for it so a guarded page never flash-redirects.
  if (isAbilityLoading) {
    return <PageLoader />;
  }

  // Check CASL ability
  if (checkAbility && !checkAbility(ability)) {
    // Say why: a silent redirect to the home page reads as a bug.
    return <Navigate to="/" replace state={{ accessDenied: true }} />;
  }

  return children;
}
