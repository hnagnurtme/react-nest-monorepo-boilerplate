import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique('uq_users_email'),
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
  (table) => [index('idx_users_tenant_id').on(table.tenantId)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
