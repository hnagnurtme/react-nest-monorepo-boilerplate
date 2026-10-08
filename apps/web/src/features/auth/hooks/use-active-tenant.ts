import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuthStore, type TenantMembership } from '@/entities/session';

export interface ActiveTenant {
  /** Every tenant the account may act in. Empty for a platform account. */
  tenants: TenantMembership[];
  activeTenantId: string | null;
  /** True once a tenant account has to choose before anything else will load. */
  isChoicePending: boolean;
  switchTenant: (tenantId: string) => void;
}

/**
 * The tenant this tab acts in.
 *
 * Switching throws away every cached query: the server state belongs to the old
 * tenant, and showing it under the new one would be wrong, not merely stale.
 */
export function useActiveTenant(): ActiveTenant {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const activeTenantId = useAuthStore((state) => state.activeTenantId);
  const setActiveTenant = useAuthStore((state) => state.setActiveTenant);

  const switchTenant = useCallback(
    (tenantId: string) => {
      if (tenantId === activeTenantId) return;
      setActiveTenant(tenantId);
      queryClient.clear();
    },
    [activeTenantId, queryClient, setActiveTenant],
  );

  const tenants = user?.tenants ?? [];
  const isPlatform = user?.scope === 'platform';

  return {
    tenants,
    activeTenantId,
    isChoicePending: user !== null && !isPlatform && activeTenantId === null,
    switchTenant,
  };
}
