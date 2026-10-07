import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { defineAbilityFor, defineAnonymousAbility, type AppAbility } from '@repo/shared-types';

import { toUserContext, useAuthStore } from '@/entities/session';

const AbilityContext = createContext<AppAbility>(defineAnonymousAbility());

/**
 * CASL ability provider. Recomputes ability when the user changes.
 */
export function AbilityProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);

  const ability = useMemo<AppAbility>(() => {
    if (!user) {
      return defineAnonymousAbility();
    }

    return defineAbilityFor(toUserContext(user));
  }, [user]);

  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
}

/**
 * Hook to access current user's CASL ability.
 */
export function useAbility(): AppAbility {
  return useContext(AbilityContext);
}
