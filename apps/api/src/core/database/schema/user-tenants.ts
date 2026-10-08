import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * Which tenants an account may act in (ADR-0003 refinement).
 *
 * This is the authority for membership: the `users` RLS policy resolves
 * visibility through it, so a user can belong to several tenants while every
 * request still acts inside exactly one of them (the `x-tenant-id` header,
 * validated against this table by `JwtAuthGuard`).
 *
 * `users.tenant_id` survives as the home tenant — it marks a platform account
 * (NULL) and feeds the INSERT path, where no membership row exists yet. A
 * trigger keeps it present here, so the two cannot drift.
 */
export const userTenants = pgTable(
  'user_tenants',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'pk_user_tenants', columns: [table.userId, table.tenantId] }),
    index('idx_user_tenants_tenant_id').on(table.tenantId),
  ],
);

export type UserTenant = typeof userTenants.$inferSelect;
export type NewUserTenant = typeof userTenants.$inferInsert;
