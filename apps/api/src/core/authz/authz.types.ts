import type { PermissionGrant, RoleScope } from '@repo/shared-types';

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  scope: RoleScope;
}

/** A tenant the account may act in. */
export interface TenantMembership {
  id: string;
  name: string;
  /** Stable, human-readable handle. The web puts it in the URL as `?tenant=<slug>`. */
  slug: string;
}

export interface ProfileRole extends RoleSummary {
  /**
   * The tenant the assignment was made in, `null` for a platform-scope role.
   * Not the role's own `tenant_id`: a system role lives outside every tenant
   * but is still assigned inside one.
   */
  assignedTenantId: string | null;
}

/**
 * Everything the API needs to know about "who is calling" beyond the token.
 * Loaded from the database (cached in Redis), never trusted from the token, so a
 * role change or a deactivation takes effect on the next request.
 *
 * An account may belong to several tenants, so grants are kept per tenant:
 * being TENANT_ADMIN in one tenant must not grant anything in another. The
 * tenant the request acts in comes from the `x-tenant-id` header, validated
 * against `tenants` by `JwtAuthGuard`.
 */
export interface AuthzProfile {
  userId: string;
  email: string;
  /** Marks a platform account (`null`) and is the tenant a new account was created in. */
  homeTenantId: string | null;
  tenants: TenantMembership[];
  /** 'platform' when the user holds any platform-scope role. Decides the RLS access mode. */
  scope: RoleScope;
  roles: ProfileRole[];
  /** Grants of platform-scope roles — they apply whatever tenant is active. */
  platformGrants: PermissionGrant[];
  /** Grants per tenant id, from the roles assigned inside that tenant. */
  grantsByTenant: Record<string, PermissionGrant[]>;
}

export interface RoleWithGrants extends RoleSummary {
  tenantId: string | null;
  isSystem: boolean;
  grants: PermissionGrant[];
}
