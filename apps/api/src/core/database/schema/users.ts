import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    /** Argon2id digest. The plaintext never leaves the request handler. */
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    phoneNumber: text('phone_number'),
    /** Null only for platform users, who sit above every tenant. Roles live in `user_roles`. */
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').notNull().default(true),
    isEmailVerified: boolean('is_email_verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    /**
     * Unique among live accounts only. A plain unique constraint would keep a
     * soft-deleted row's address reserved forever: the delete leaves the row in
     * place, every lookup skips it, and re-creating that account failed with a
     * bare unique violation nobody could clear.
     */
    uniqueIndex('uq_users_email_active')
      .on(table.email)
      .where(sql`deleted_at IS NULL`),
    index('idx_users_tenant_id').on(table.tenantId),
    /**
     * `?search=` is `ILIKE '%term%'`, whose leading `%` no b-tree can serve.
     * GIN + `gin_trgm_ops` can, so the directory stays an index scan as the
     * table grows. The extension is created by `migrate.ts`, which runs as
     * superuser before it drops to the owner role.
     */
    index('idx_users_full_name_trgm').using('gin', sql`${table.fullName} gin_trgm_ops`),
    index('idx_users_email_trgm').using('gin', sql`${table.email} gin_trgm_ops`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
