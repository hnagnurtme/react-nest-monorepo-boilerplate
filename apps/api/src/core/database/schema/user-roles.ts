import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';

import { roles } from './roles.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * `tenant_id` is denormalised from the user so the RLS policy can filter on it
 * without a join; a trigger keeps it equal to `users.tenant_id`.
 */
export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'pk_user_roles', columns: [table.userId, table.roleId] }),
    index('idx_user_roles_role_id').on(table.roleId),
    index('idx_user_roles_tenant_id').on(table.tenantId),
  ],
);

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;
