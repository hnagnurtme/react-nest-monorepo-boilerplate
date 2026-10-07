import { sql } from 'drizzle-orm';
import { check, index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { permissions } from './permissions.js';
import { roles } from './roles.js';

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    /** How far the permission reaches: 'any' | 'own_tenant' | 'own_record'. */
    scopePreset: text('scope_preset').notNull().default('own_tenant'),
  },
  (table) => [
    primaryKey({ name: 'pk_role_permissions', columns: [table.roleId, table.permissionId] }),
    check(
      'ck_role_permissions_preset',
      sql`${table.scopePreset} IN ('any', 'own_tenant', 'own_record')`,
    ),
    index('idx_role_permissions_permission_id').on(table.permissionId),
  ],
);

export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
