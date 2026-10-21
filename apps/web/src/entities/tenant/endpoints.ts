import type { paths } from '@repo/api-contract';

/**
 * The tenant directory: every tenant the caller may act in.
 *
 * It lives with the entity rather than in `features/tenants` because the one
 * thing that needs it earliest is the session's own tenant resolution
 * (`useActiveTenant`), and a feature may not be imported from another feature's
 * hook without making the two barrels circular. `features/tenants` re-exports
 * the hook, so the picker still reads as part of that feature.
 */
export const TENANT_DIRECTORY_ENDPOINTS = {
  MINE: '/api/v1/tenants/mine',
} as const satisfies Record<string, keyof paths>;
