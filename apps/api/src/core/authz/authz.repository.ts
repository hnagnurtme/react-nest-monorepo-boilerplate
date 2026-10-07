import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, ne, count } from 'drizzle-orm';

import type { Action, ScopePreset } from '@repo/shared-types';

import type { Tx } from '@/core/database/drizzle.module.js';
import {
  permissions,
  rolePermissions,
  roles,
  userRoles,
  users,
} from '@/core/database/schema/index.js';

import type { AuthzProfile, RoleSummary, RoleWithGrants } from './authz.types.js';

type ProfileRows = Pick<AuthzProfile, 'userId' | 'email' | 'tenantId' | 'roles' | 'grants'>;

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

    const roleRows = await tx
      .select({ id: roles.id, key: roles.key, name: roles.name, scope: roles.scope })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(userRoles.userId, userId), isNull(roles.deletedAt)));

    const roleSummaries: RoleSummary[] = roleRows.map((row) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      scope: row.scope === 'platform' ? 'platform' : 'tenant',
    }));

    const grantRows =
      roleSummaries.length === 0
        ? []
        : await tx
            .select({
              action: permissions.action,
              subject: permissions.subject,
              preset: rolePermissions.scopePreset,
            })
            .from(rolePermissions)
            .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
            .where(
              inArray(
                rolePermissions.roleId,
                roleSummaries.map((r) => r.id),
              ),
            );

    return {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: roleSummaries,
      grants: grantRows.map((row) => ({
        action: row.action as Action,
        subject: row.subject,
        preset: row.preset as ScopePreset,
      })),
    };
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

  /** Replaces the whole assignment set. `tenant_id` is filled in by the trigger. */
  async replaceUserRoles(
    tx: Tx,
    userId: string,
    roleIds: readonly string[],
    grantedBy: string,
  ): Promise<void> {
    await tx.delete(userRoles).where(eq(userRoles.userId, userId));
    if (roleIds.length === 0) return;

    await tx.insert(userRoles).values(roleIds.map((roleId) => ({ userId, roleId, grantedBy })));
  }

  /** Active users of a tenant holding a role key, optionally ignoring one user. */
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
          eq(users.tenantId, tenantId),
          eq(users.isActive, true),
          isNull(users.deletedAt),
          eq(roles.key, roleKey),
          ne(users.id, excludeUserId),
        ),
      );
    return row?.total ?? 0;
  }
}
