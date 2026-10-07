import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';

/**
 * `role` is text plus a CHECK rather than a pgEnum: adding a value to a
 * Postgres enum is a migration that cannot run inside a transaction on older
 * versions and cannot be reverted, whereas a CHECK is an ordinary edit
 * (docs/rules/03-database-drizzle.md B6).
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique('uq_users_email'),
    /** Argon2id digest. The plaintext never leaves the request handler. */
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    phoneNumber: text('phone_number'),
    role: text('role').notNull().default('TENANT_MEMBER'),
    /** Null only for PLATFORM_ADMIN, which sits above every tenant. */
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').notNull().default(true),
    isEmailVerified: boolean('is_email_verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'ck_users_role',
      sql`${table.role} IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'TENANT_MEMBER')`,
    ),
    // A tenant role without a tenant (or a platform admin with one) would make
    // the access mode derived at login ambiguous.
    check(
      'ck_users_tenant_role',
      sql`(${table.role} IN ('TENANT_ADMIN', 'TENANT_MEMBER')) = (${table.tenantId} IS NOT NULL)`,
    ),
    index('idx_users_tenant_id').on(table.tenantId),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
