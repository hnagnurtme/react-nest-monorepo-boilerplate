import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import type { AppAbility } from '@repo/shared-types';

import { useAuthStore, type PublicUser } from '@/entities/session';
import { useAbility } from '@/features/auth';
import { PageLoader } from '@/shared/ui';

interface RouteGuardProps {
  allowedRoles?: PublicUser['role'][];
  checkAbility?: (ability: AppAbility) => boolean;
  children: ReactNode;
}

export function RouteGuard({
  allowedRoles,
  checkAbility,
  children,
}: RouteGuardProps): React.ReactNode {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  const ability = useAbility();

  // Wait for session initialization
  if (status === 'initializing') {
    return <PageLoader />;
  }

  // Redirect to login if not authenticated
  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  // Check CASL ability
  if (checkAbility && !checkAbility(ability)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
