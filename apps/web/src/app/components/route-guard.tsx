import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import type { AppAbility } from '@repo/shared-types';

import { useAuthStore } from '@/entities/session';
import { useAbility, useAbilityLoading, useActiveTenant } from '@/features/auth';
import { PageLoader } from '@/shared/ui';

interface RouteGuardProps {
  checkAbility?: ((ability: AppAbility) => boolean) | undefined;
  children: ReactNode;
}

export function RouteGuard({ checkAbility, children }: RouteGuardProps): React.ReactNode {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const ability = useAbility();
  const isAbilityLoading = useAbilityLoading();
  const { isChoicePending } = useActiveTenant();

  // Wait for session initialization
  if (status === 'initializing') {
    return <PageLoader />;
  }

  // Redirect to login if not authenticated
  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Nothing tenant-scoped can load before the account says which tenant it is
  // working in — the API rejects such a request rather than picking one.
  if (isChoicePending) {
    return <Navigate to="/select-tenant" state={{ from: location }} replace />;
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
