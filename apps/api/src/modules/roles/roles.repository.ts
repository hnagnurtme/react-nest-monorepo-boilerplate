import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { permissionKey } from '@repo/shared-types';

import type { Tx } from '@/core/database/drizzle.module.js';
import {
  permissions,
  rolePermissions,
  roles,
  userRoles,
  type NewRole,
  type Role,
} from '@/core/database/schema/index.js';

/** Isolation is the RLS policy on `roles`; never export this class from the module index. */
@Injectable()
export class RolesRepository {
  async list(tx: Tx, page: { limit: number; offset: number }): Promise<Role[]> {
    return tx
      .select()
      .from(roles)
      .where(isNull(roles.deletedAt))
      .orderBy(desc(roles.isSystem), roles.name, roles.id)
      .limit(page.limit)
      .offset(page.offset);
  }

  async count(tx: Tx): Promise<number> {
    const [row] = await tx.select({ total: count() }).from(roles).where(isNull(roles.deletedAt));
    return row?.total ?? 0;
  }

  async findById(tx: Tx, id: string): Promise<Role | undefined> {
    const [row] = await tx
      .select()
      .from(roles)
      .where(and(eq(roles.id, id), isNull(roles.deletedAt)))
      .limit(1);
    return row;
  }

  async create(tx: Tx, values: NewRole): Promise<Role> {
    const [row] = await tx.insert(roles).values(values).returning();
    if (row === undefined) throw new Error('role insert returned no row');
    return row;
  }

  async rename(tx: Tx, id: string, name: string): Promise<Role | undefined> {
    const [row] = await tx
      .update(roles)
      .set({ name, updatedAt: sql`now()` })
      .where(and(eq(roles.id, id), isNull(roles.deletedAt)))
      .returning();
    return row;
  }

  async softDelete(tx: Tx, id: string): Promise<void> {
    await tx
      .update(roles)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(roles.id, id));
  }

  async countAssignments(tx: Tx, roleId: string): Promise<number> {
    const [row] = await tx
      .select({ total: count() })
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId));
    return row?.total ?? 0;
  }

  /** "action:subject" -> permission id, for the given keys. */
  async permissionIds(tx: Tx, keys: readonly string[]): Promise<Map<string, string>> {
    const rows = await tx
      .select({ id: permissions.id, action: permissions.action, subject: permissions.subject })
      .from(permissions)
      .where(inArray(sql`${permissions.action} || ':' || ${permissions.subject}`, [...keys]));

    return new Map(rows.map((row) => [permissionKey(row.action, row.subject), row.id]));
  }

  async replaceGrants(
    tx: Tx,
    roleId: string,
    grants: readonly { permissionId: string; scopePreset: string }[],
  ): Promise<void> {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (grants.length === 0) return;

    await tx.insert(rolePermissions).values(grants.map((grant) => ({ roleId, ...grant })));
  }
}
