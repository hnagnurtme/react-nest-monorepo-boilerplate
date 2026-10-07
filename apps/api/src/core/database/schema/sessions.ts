import { type AnyPgColumn, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from './users.js';

/**
 * One row per refresh token ever issued.
 *
 * A single login opens a `family_id`; each rotation appends a row pointing at
 * its predecessor. That chain is what makes reuse detectable: if a token that
 * already has `used_at` comes back, the whole family is revoked
 * (docs/03-auth-flow-va-casl-abac.md 1.3).
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** One login = one family. Revocation happens per family, not per token. */
    familyId: uuid('family_id').notNull(),
    /** SHA-256 of the token. The raw token is never stored, anywhere. */
    tokenHash: text('token_hash').notNull().unique('uq_sessions_token_hash'),
    parentId: uuid('parent_id').references((): AnyPgColumn => sessions.id, {
      onDelete: 'set null',
    }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_sessions_family_id').on(table.familyId),
    index('idx_sessions_user_id').on(table.userId),
  ],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
