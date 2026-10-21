import type { paths } from '@repo/api-contract';

/** See `features/users/endpoints.ts` for why these are `paths` keys. */
export const TENANT_ENDPOINTS = {
  TENANTS: '/api/v1/tenants',
  TENANT: '/api/v1/tenants/{id}',
  /* The picker's own path belongs to `entities/tenant`: the session resolves
     the active tenant against that list before any feature is mounted. */
  /** Returns a presigned PUT; the browser uploads straight to the bucket. */
  LOGO_UPLOAD_URL: '/api/v1/tenants/{id}/logo/upload-url',
  PROVINCES: '/api/v1/administrative-units/provinces',
  WARDS: '/api/v1/administrative-units/provinces/{code}/wards',
} as const satisfies Record<string, keyof paths>;
