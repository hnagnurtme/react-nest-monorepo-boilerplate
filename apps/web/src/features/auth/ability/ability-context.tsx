import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import {
  abilityFromPacked,
  defineAnonymousAbility,
  type AppAbility,
  type PackedRules,
} from '@repo/shared-types';

import { useAuthStore } from '@/entities/session';
import { AUTH_ENDPOINTS } from '@/features/auth/endpoints';
import { apiClient } from '@/lib/http/client';

export const abilityKeys = {
  all: ['abilities'] as const,
  session: (userId: string, accessToken: string | null) =>
    ['abilities', userId, accessToken] as const,
};

interface AbilityState {
  ability: AppAbility;
  /** True while the signed-in user's rules are being fetched for the first time. */
  isLoading: boolean;
}

const AbilityContext = createContext<AbilityState>({
  ability: defineAnonymousAbility(),
  isLoading: false,
});

/**
 * CASL ability provider. The rules come from the API (permissions live in the
 * database), so the ability is fetched once authenticated and refetched whenever
 * the session changes (login, token refresh, user switch).
 */
export function AbilityProvider({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isSignedIn = status === 'authenticated' && userId !== null;

  const query = useQuery<PackedRules>({
    queryKey: abilityKeys.session(userId ?? '', accessToken),
    enabled: isSignedIn,
    // Keep the previous rules across a token refresh of the same user (no UI flash).
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === userId ? previous : undefined,
    staleTime: 0,
    queryFn: async () => {
      const { rules } = await apiClient.get(AUTH_ENDPOINTS.ABILITIES);
      return rules as PackedRules;
    },
  });

  const rules = isSignedIn ? query.data : undefined;
  const isLoading = isSignedIn && query.isPending;

  const state = useMemo<AbilityState>(
    () => ({
      ability: rules ? abilityFromPacked(rules) : defineAnonymousAbility(),
      isLoading,
    }),
    [rules, isLoading],
  );

  return <AbilityContext.Provider value={state}>{children}</AbilityContext.Provider>;
}

/**
 * Hook to access current user's CASL ability.
 */
export function useAbility(): AppAbility {
  return useContext(AbilityContext).ability;
}

/** True while the ability of a signed-in user has not loaded yet. */
export function useAbilityLoading(): boolean {
  return useContext(AbilityContext).isLoading;
}
