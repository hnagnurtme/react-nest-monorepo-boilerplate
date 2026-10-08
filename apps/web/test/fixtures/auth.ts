import {
  buildAbility,
  packAbility,
  SYSTEM_ROLES,
  type PackedRules,
  type PermissionGrant,
} from '@repo/shared-types';

import { useAuthStore, type PublicUser } from '@/entities/session';

export interface AuthBody {
  accessToken: string;
  user: PublicUser;
  csrfToken?: string;
  refreshToken?: string;
}

export function makeUser(overrides?: Partial<PublicUser>): PublicUser {
  return {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    scope: 'tenant',
    roles: [{ key: 'TENANT_MEMBER', name: 'Tenant member' }],
    tenantId: 'tenant-1',
    tenants: [{ id: 'tenant-1', name: 'Acme' }],
    ...overrides,
  };
}

export function makeTenantAdmin(overrides?: Partial<PublicUser>): PublicUser {
  return makeUser({
    id: 'admin-1',
    roles: [{ key: 'TENANT_ADMIN', name: 'Tenant administrator' }],
    ...overrides,
  });
}

export function makePlatformAdmin(overrides?: Partial<PublicUser>): PublicUser {
  const user = makeUser({
    id: 'root',
    scope: 'platform',
    roles: [{ key: 'PLATFORM_ADMIN', name: 'Platform administrator' }],
    // A platform account sits above every tenant, so it belongs to none.
    tenants: [],
    ...overrides,
  });
  delete user.tenantId;
  return user;
}

/** Grants of the seeded system roles; permissions now live in the database. */
export const MEMBER_GRANTS: readonly PermissionGrant[] = SYSTEM_ROLES.TENANT_MEMBER.grants;
export const TENANT_ADMIN_GRANTS: readonly PermissionGrant[] = SYSTEM_ROLES.TENANT_ADMIN.grants;
export const PLATFORM_ADMIN_GRANTS: readonly PermissionGrant[] = SYSTEM_ROLES.PLATFORM_ADMIN.grants;

/** What GET /auth/me/abilities returns for these grants. */
export function packedRulesFor(user: PublicUser, grants: readonly PermissionGrant[]): PackedRules {
  return packAbility(buildAbility(grants, { id: user.id, tenantId: user.tenantId }));
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const ABILITIES_URL = '/api/v1/auth/me/abilities';

export function abilitiesResponse(user: PublicUser, grants: readonly PermissionGrant[]): Response {
  return jsonResponse({ data: { rules: packedRulesFor(user, grants) } });
}

export function makeRefreshResponse(overrides?: Partial<AuthBody>): { data: AuthBody } {
  return {
    data: {
      accessToken: 'mock-access-token',
      user: makeUser(),
      csrfToken: 'mock-csrf-token',
      ...overrides,
    },
  };
}

export function problem(
  status: number,
  code: string,
  detail?: string,
): {
  status: number;
  title: string;
  code: string;
  detail: string;
  traceId: string;
} {
  return {
    status,
    title: code
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' '),
    code,
    detail: detail ?? `Error: ${code}`,
    traceId: 'trace-123',
  };
}

export function setSessionUser(user: PublicUser): void {
  // The real store resolves the active tenant on sign-in, and nothing
  // tenant-scoped renders without one.
  const [only] = user.tenants;
  const activeTenantId =
    user.scope === 'platform' || user.tenants.length !== 1 || only === undefined ? null : only.id;
  useAuthStore.setState({ status: 'authenticated', accessToken: 'token', user, activeTenantId });
}
