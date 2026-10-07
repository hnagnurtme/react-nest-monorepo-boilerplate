import { Injectable } from '@nestjs/common';

import type { Tx } from '@/core/database/drizzle.module.js';
import { auditLogs } from '@/core/database/schema/index.js';

export interface AuditEntry {
  actorId: string;
  tenantId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeState?: unknown;
  afterState?: unknown;
}

/**
 * Appends to `audit_logs` inside the caller's transaction, so the record
 * commits or rolls back together with the change it describes
 * (docs/rules/07-security.md E4). Never put secrets (password hashes) in the
 * before/after snapshots.
 */
@Injectable()
export class AuditService {
  async record(tx: Tx, entry: AuditEntry): Promise<void> {
    await tx.insert(auditLogs).values({
      actorId: entry.actorId,
      tenantId: entry.tenantId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      beforeState: entry.beforeState ?? null,
      afterState: entry.afterState ?? null,
    });
  }
}
