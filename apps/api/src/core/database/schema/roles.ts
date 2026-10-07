import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';

/**
 * `tenant_id IS NULL` marks a shared, system-owned role (PLATFORM_ADMIN,
 * TENANT_ADMIN, TENANT_MEMBER): visible to every tenant, writable by none.
 * `scope` says which kind of user may hold it.
 */
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    name: text('name').notNull(),
    scope: text('scope').notNull().default('tenant'),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    check('ck_roles_scope', sql`${table.scope} IN ('platform', 'tenant')`),
    // A system role has no tenant; a custom role always has one.
    check('ck_roles_system_tenant', sql`(${table.isSystem}) = (${table.tenantId} IS NULL)`),
    // Custom roles are tenant-scoped: a platform-scope role can only be a system role.
    check('ck_roles_platform_system', sql`${table.scope} = 'tenant' OR ${table.isSystem}`),
    uniqueIndex('uq_roles_tenant_key')
      .on(table.tenantId, table.key)
      .where(sql`tenant_id IS NOT NULL AND deleted_at IS NULL`),
    uniqueIndex('uq_roles_system_key')
      .on(table.key)
      .where(sql`tenant_id IS NULL`),
    index('idx_roles_tenant_id').on(table.tenantId),
  ],
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
