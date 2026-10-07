import type { PermissionGrant, RoleScope } from '@repo/shared-types';

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  scope: RoleScope;
}

/**
 * Everything the API needs to know about "who is calling" beyond the token.
 * Loaded from the database (cached in Redis), never trusted from the token, so a
 * role change or a deactivation takes effect on the next request.
 */
export interface AuthzProfile {
  userId: string;
  email: string;
  tenantId: string | null;
  /** 'platform' when the user holds any platform-scope role. Decides the RLS access mode. */
  scope: RoleScope;
  roles: RoleSummary[];
  grants: PermissionGrant[];
}

export interface RoleWithGrants extends RoleSummary {
  tenantId: string | null;
  isSystem: boolean;
  grants: PermissionGrant[];
}
