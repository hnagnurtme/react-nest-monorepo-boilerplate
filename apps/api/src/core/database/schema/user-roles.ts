import { sql } from 'drizzle-orm';
import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { roles } from './roles.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * Which roles an account holds, per tenant.
 *
 * `tenant_id` lets the RLS policy filter without a join, and names the
 * membership the assignment belongs to: an account can be TENANT_ADMIN in one
 * tenant and TENANT_MEMBER in another, so the same `(user_id, role_id)` pair is
 * legitimate in two tenants. That is why the key is on all three columns —
 * as two partial unique indexes, because a primary key cannot cover the
 * nullable `tenant_id` a platform-scope assignment carries.
 */
export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
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
    uniqueIndex('uq_user_roles_tenant')
      .on(table.userId, table.roleId, table.tenantId)
      .where(sql`tenant_id IS NOT NULL`),
    uniqueIndex('uq_user_roles_platform')
      .on(table.userId, table.roleId)
      .where(sql`tenant_id IS NULL`),
    index('idx_user_roles_role_id').on(table.roleId),
    index('idx_user_roles_tenant_id').on(table.tenantId),
  ],
);

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;
