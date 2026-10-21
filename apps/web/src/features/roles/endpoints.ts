import type { paths } from '@repo/api-contract';

/** See `features/users/endpoints.ts` for why these are `paths` keys. */
export const ROLE_ENDPOINTS = {
  ROLES: '/api/v1/roles',
  ROLE: '/api/v1/roles/{id}',
  ROLE_PERMISSIONS: '/api/v1/roles/{id}/permissions',
  PERMISSIONS: '/api/v1/permissions',
} as const satisfies Record<string, keyof paths>;
