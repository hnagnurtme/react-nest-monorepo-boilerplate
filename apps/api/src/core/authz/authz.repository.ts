import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, ne, count } from 'drizzle-orm';

import type { Action, PermissionGrant, ScopePreset } from '@repo/shared-types';

import type { Tx } from '@/core/database/drizzle.module.js';
import {
  permissions,
  rolePermissions,
  roles,
  tenants,
  userRoles,
  users,
  userTenants,
} from '@/core/database/schema/index.js';

import type { AuthzProfile, ProfileRole, RoleSummary, RoleWithGrants } from './authz.types.js';

type ProfileRows = Pick<
  AuthzProfile,
  'userId' | 'email' | 'homeTenantId' | 'tenants' | 'roles' | 'platformGrants' | 'grantsByTenant'
>;

/** Read side of authorization. Callers pass a transaction opened in 'admin' mode. */
@Injectable()
export class AuthzRepository {
  /** `undefined` for a missing, deleted or inactive user. */
  async loadProfileRows(tx: Tx, userId: string): Promise<ProfileRows | undefined> {
    const [user] = await tx
      .select({ id: users.id, email: users.email, tenantId: users.tenantId })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.isActive, true), isNull(users.deletedAt)))
      .limit(1);
    if (user === undefined) return undefined;

    const membershipRows = await tx
      .select({ id: tenants.id, name: tenants.name })
      .from(userTenants)
      .innerJoin(tenants, eq(tenants.id, userTenants.tenantId))
      .where(and(eq(userTenants.userId, userId), isNull(tenants.deletedAt)));

    const roleRows = await tx
      .select({
        id: roles.id,
        key: roles.key,
        name: roles.name,
        scope: roles.scope,
        assignedTenantId: userRoles.tenantId,
      })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(userRoles.userId, userId), isNull(roles.deletedAt)));

    const roleAssignments: ProfileRole[] = roleRows.map((row) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      scope: row.scope === 'platform' ? 'platform' : 'tenant',
      assignedTenantId: row.assignedTenantId,
    }));

    const grantsByRole = await this.grantsByRoleId(
      tx,
      roleAssignments.map((role) => role.id),
    );

    // Kept apart on purpose: an account that administers one tenant must not
    // carry those grants into another tenant it merely belongs to.
    const platformGrants: PermissionGrant[] = [];
    const grantsByTenant: Record<string, PermissionGrant[]> = {};

    for (const role of roleAssignments) {
      const grants = grantsByRole.get(role.id) ?? [];
      if (role.assignedTenantId === null) {
        platformGrants.push(...grants);
        continue;
      }
      const bucket = grantsByTenant[role.assignedTenantId];
      if (bucket === undefined) {
        grantsByTenant[role.assignedTenantId] = [...grants];
      } else {
        bucket.push(...grants);
      }
    }

    return {
      userId: user.id,
      email: user.email,
      homeTenantId: user.tenantId,
      tenants: membershipRows,
      roles: roleAssignments,
      platformGrants,
      grantsByTenant,
    };
  }

  private async grantsByRoleId(
    tx: Tx,
    roleIds: readonly string[],
  ): Promise<Map<string, PermissionGrant[]>> {
    const result = new Map<string, PermissionGrant[]>();
    if (roleIds.length === 0) return result;

    const rows = await tx
      .select({
        roleId: rolePermissions.roleId,
        action: permissions.action,
        subject: permissions.subject,
        preset: rolePermissions.scopePreset,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(inArray(rolePermissions.roleId, [...roleIds]));

    for (const row of rows) {
      const grant: PermissionGrant = {
        action: row.action as Action,
        subject: row.subject,
        preset: row.preset as ScopePreset,
      };
      const list = result.get(row.roleId);
      if (list === undefined) result.set(row.roleId, [grant]);
      else list.push(grant);
    }
    return result;
  }

  /** Users that hold a role, for cache invalidation when the role changes. */
  async userIdsWithRole(tx: Tx, roleId: string): Promise<string[]> {
    const rows = await tx
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId));
    return rows.map((row) => row.userId);
  }

  /** Roles visible to the caller (RLS), with their grants. Ids the caller cannot see are simply absent. */
  async loadRolesWithGrants(tx: Tx, roleIds: readonly string[]): Promise<RoleWithGrants[]> {
    if (roleIds.length === 0) return [];

    const roleRows = await tx
      .select()
      .from(roles)
      .where(and(inArray(roles.id, [...roleIds]), isNull(roles.deletedAt)));
    if (roleRows.length === 0) return [];

    const grantRows = await tx
      .select({
        roleId: rolePermissions.roleId,
        action: permissions.action,
        subject: permissions.subject,
        preset: rolePermissions.scopePreset,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(
        inArray(
          rolePermissions.roleId,
          roleRows.map((r) => r.id),
        ),
      );

    return roleRows.map((row) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      scope: row.scope === 'platform' ? 'platform' : 'tenant',
      tenantId: row.tenantId,
      isSystem: row.isSystem,
      grants: grantRows
        .filter((g) => g.roleId === row.id)
        .map((g) => ({
          action: g.action as Action,
          subject: g.subject,
          preset: g.preset as ScopePreset,
        })),
    }));
  }

  async rolesForUsers(tx: Tx, userIds: readonly string[]): Promise<Map<string, RoleSummary[]>> {
    const result = new Map<string, RoleSummary[]>();
    if (userIds.length === 0) return result;

    const rows = await tx
      .select({
        userId: userRoles.userId,
        id: roles.id,
        key: roles.key,
        name: roles.name,
        scope: roles.scope,
      })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(inArray(userRoles.userId, [...userIds]), isNull(roles.deletedAt)));

    for (const row of rows) {
      const list = result.get(row.userId) ?? [];
      list.push({
        id: row.id,
        key: row.key,
        name: row.name,
        scope: row.scope === 'platform' ? 'platform' : 'tenant',
      });
      result.set(row.userId, list);
    }
    return result;
  }

  /**
   * Replaces the assignment set *inside one tenant*, or the platform-scope set
   * when `tenantId` is null. Assignments the account holds in other tenants are
   * left alone: a tenant admin edits their own tenant, nothing beyond it.
   *
   * `tenant_id` is passed explicitly — the trigger no longer derives it, since
   * an account can belong to several tenants.
   */
  async replaceUserRoles(
    tx: Tx,
    userId: string,
    tenantId: string | null,
    roleIds: readonly string[],
    grantedBy: string,
  ): Promise<void> {
    await tx
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          tenantId === null ? isNull(userRoles.tenantId) : eq(userRoles.tenantId, tenantId),
        ),
      );
    if (roleIds.length === 0) return;

    await tx
      .insert(userRoles)
      .values(roleIds.map((roleId) => ({ userId, roleId, tenantId, grantedBy })));
  }

  /**
   * Tenants where the account holds a role key — the tenants a deactivation
   * would strip of an administrator. Rows the caller cannot see are absent.
   */
  async tenantIdsWithRoleKey(tx: Tx, userId: string, roleKey: string): Promise<string[]> {
    const rows = await tx
      .select({ tenantId: userRoles.tenantId })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(userRoles.userId, userId), eq(roles.key, roleKey), isNull(roles.deletedAt)));

    return rows.flatMap((row) => (row.tenantId === null ? [] : [row.tenantId]));
  }

  /**
   * Active accounts holding a role key *in one tenant*, ignoring one account.
   *
   * Counted on the assignment's tenant, not on `users.tenant_id`: an account
   * whose home tenant is elsewhere still administers the tenants it joined.
   */
  async countActiveWithRoleKey(
    tx: Tx,
    tenantId: string,
    roleKey: string,
    excludeUserId: string,
  ): Promise<number> {
    const [row] = await tx
      .select({ total: count() })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(
        and(
          eq(userRoles.tenantId, tenantId),
          eq(users.isActive, true),
          isNull(users.deletedAt),
          eq(roles.key, roleKey),
          ne(users.id, excludeUserId),
        ),
      );
    return row?.total ?? 0;
  }
}
