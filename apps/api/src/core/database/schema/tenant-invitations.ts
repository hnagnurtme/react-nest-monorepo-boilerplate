import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * A pending request for an existing account to join a tenant.
 *
 * In the database rather than in Redis, unlike the account invitations in
 * `InvitationService`: an outstanding invitation is business state the tenant
 * has to be able to see, withdraw and resend, and losing the lot to a cache
 * restart turns into a 404 that reads like a bug.
 *
 * Only the token's hash is stored, so a dump of this table hands out no live
 * links. `role_ids` is an array rather than a join table because it is a
 * snapshot of what was offered, not a relationship: the roles are re-loaded and
 * re-checked when the invitation is accepted.
 */
export const tenantInvitations = pgTable(
  'tenant_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleIds: uuid('role_ids').array().notNull(),
    tokenHash: text('token_hash').notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_tenant_invitations_tenant_id').on(table.tenantId),
    uniqueIndex('uq_tenant_invitations_token_hash').on(table.tokenHash),
    // At most one live invitation per account and tenant: re-inviting withdraws
    // the previous link rather than leaving two that both work.
    uniqueIndex('uq_tenant_invitations_pending')
      .on(table.tenantId, table.userId)
      .where(sql`accepted_at IS NULL AND revoked_at IS NULL`),
  ],
);

export type TenantInvitationRow = typeof tenantInvitations.$inferSelect;
export type NewTenantInvitation = typeof tenantInvitations.$inferInsert;
