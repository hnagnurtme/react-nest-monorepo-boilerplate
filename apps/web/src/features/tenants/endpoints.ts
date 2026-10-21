import type { paths } from '@repo/api-contract';

/** See `features/users/endpoints.ts` for why these are `paths` keys. */
export const TENANT_ENDPOINTS = {
  TENANTS: '/api/v1/tenants',
  TENANT: '/api/v1/tenants/{id}',
} as const satisfies Record<string, keyof paths>;
