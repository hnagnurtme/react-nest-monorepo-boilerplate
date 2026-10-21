import type { paths } from '@repo/api-contract';

/**
 * Every users path, spelled once.
 *
 * `satisfies Record<string, keyof paths>` is what turns a typo into a compile
 * error instead of a runtime 404, and it keeps the `{id}` forms honest: they
 * are `paths` keys too, so a renamed route breaks here rather than in a
 * template string somewhere in a hook.
 */
export const USER_ENDPOINTS = {
  USERS: '/api/v1/users',
  USER: '/api/v1/users/{id}',
  USER_ROLES: '/api/v1/users/{id}/roles',
  USER_RESEND_INVITATION: '/api/v1/users/{id}/resend-invitation',
  TENANT_INVITATIONS: '/api/v1/tenant-invitations',
  TENANT_INVITATION: '/api/v1/tenant-invitations/{id}',
  TENANT_INVITATION_RESEND: '/api/v1/tenant-invitations/{id}/resend',
  TENANT_INVITATION_BY_TOKEN: '/api/v1/tenant-invitations/token/{token}',
  TENANT_INVITATION_ACCEPT: '/api/v1/tenant-invitations/accept',
} as const satisfies Record<string, keyof paths>;
