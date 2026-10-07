import { type ReactNode } from 'react';

import type { Action, Subject } from '@repo/shared-types';

import { useAbility } from './ability-context';

export interface CanActionProps {
  I: Action;
  a?: Subject;
  this?: unknown;
  field?: string;
  passThrough?: boolean;
  children: ReactNode | ((isAllowed: boolean) => ReactNode);
}

/**
 * Component to conditionally render UI elements based on user permissions.
 * Supports:
 * - <CanAction I="create" a="User"> ... </CanAction>
 * - <CanAction I="update" a="User" this={userEntity}> ... </CanAction>
 */
export function CanAction({
  I,
  a,
  this: thisSubject,
  field,
  passThrough = false,
  children,
}: CanActionProps) {
  const ability = useAbility();

  const target = thisSubject ?? a;
  const isAllowed = target !== undefined ? ability.can(I, target as never, field) : false;

  if (typeof children === 'function') {
    return children(isAllowed);
  }

  if (passThrough) {
    return isAllowed ? children : null;
  }

  return isAllowed ? children : null;
}
