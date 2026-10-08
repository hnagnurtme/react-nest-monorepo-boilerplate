import type { paths } from '@repo/api-contract';

export const SYSTEM_ENDPOINTS = {
  HEALTH: '/healthz',
} as const satisfies Record<string, keyof paths>;

/** The tenant an authenticated request acts in; see `setTenantProvider`. */
export const TENANT_HEADER_NAME = 'x-tenant-id';
