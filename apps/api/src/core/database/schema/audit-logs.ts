import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * Who did what, when, from where, and what the record looked like either side
 * of the change (docs/rules/07-security.md E4).
 *
 * `actorId` is nullable and `onDelete: 'set null'`: deleting a user must not
 * delete the evidence of what they did.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    ipAddress: text('ip_address'),
    beforeState: jsonb('before_state'),
    afterState: jsonb('after_state'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_audit_logs_tenant_id').on(table.tenantId),
    index('idx_audit_logs_actor_id').on(table.actorId),
    index('idx_audit_logs_created_at').on(table.createdAt),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
