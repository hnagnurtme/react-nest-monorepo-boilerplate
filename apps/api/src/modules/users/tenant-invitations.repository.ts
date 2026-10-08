import { Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { Tx } from '@/core/database/drizzle.module.js';
import {
  tenantInvitations,
  tenants,
  users,
  type TenantInvitationRow,
} from '@/core/database/schema/index.js';

/** A pending invitation with the names the admin UI shows. */
export interface PendingInvitationRow {
  id: string;
  tenantId: string;
  userId: string;
  email: string;
  fullName: string;
  roleIds: string[];
  invitedBy: string | null;
  expiresAt: Date;
  createdAt: Date;
}

@Injectable()
export class TenantInvitationsRepository {
  async create(
    tx: Tx,
    values: {
      tenantId: string;
      userId: string;
      roleIds: string[];
      tokenHash: string;
      invitedBy: string;
      expiresAt: Date;
    },
  ): Promise<TenantInvitationRow> {
    const [row] = await tx.insert(tenantInvitations).values(values).returning();
    if (row === undefined) throw new Error('tenant invitation insert returned no row');

    return row;
  }

  /** The live invitation behind a token hash, whatever tenant it belongs to. */
  async findLiveByTokenHash(tx: Tx, tokenHash: string): Promise<TenantInvitationRow | undefined> {
    const [row] = await tx
      .select()
      .from(tenantInvitations)
      .where(
        and(
          eq(tenantInvitations.tokenHash, tokenHash),
          isNull(tenantInvitations.acceptedAt),
          isNull(tenantInvitations.revokedAt),
          sql`${tenantInvitations.expiresAt} > now()`,
        ),
      )
      .limit(1);

    return row;
  }

  async findById(tx: Tx, id: string): Promise<TenantInvitationRow | undefined> {
    const [row] = await tx
      .select()
      .from(tenantInvitations)
      .where(eq(tenantInvitations.id, id))
      .limit(1);

    return row;
  }

  /** Still waiting on the invitee: not accepted, not withdrawn, not expired. */
  async listPending(tx: Tx, tenantId: string): Promise<PendingInvitationRow[]> {
    return tx
      .select({
        id: tenantInvitations.id,
        tenantId: tenantInvitations.tenantId,
        userId: tenantInvitations.userId,
        email: users.email,
        fullName: users.fullName,
        roleIds: tenantInvitations.roleIds,
        invitedBy: tenantInvitations.invitedBy,
        expiresAt: tenantInvitations.expiresAt,
        createdAt: tenantInvitations.createdAt,
      })
      .from(tenantInvitations)
      .innerJoin(users, eq(users.id, tenantInvitations.userId))
      .where(
        and(
          eq(tenantInvitations.tenantId, tenantId),
          isNull(tenantInvitations.acceptedAt),
          isNull(tenantInvitations.revokedAt),
          sql`${tenantInvitations.expiresAt} > now()`,
        ),
      )
      .orderBy(desc(tenantInvitations.createdAt));
  }

  /**
   * Withdraws every live invitation of an account into a tenant.
   *
   * Called before issuing a new one: the partial unique index allows a single
   * live row per account and tenant, so re-inviting replaces the old link
   * instead of leaving two that both work.
   */
  async revokeLive(tx: Tx, tenantId: string, userId: string): Promise<number> {
    const rows = await tx
      .update(tenantInvitations)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(tenantInvitations.tenantId, tenantId),
          eq(tenantInvitations.userId, userId),
          isNull(tenantInvitations.acceptedAt),
          isNull(tenantInvitations.revokedAt),
        ),
      )
      .returning({ id: tenantInvitations.id });

    return rows.length;
  }

  async revokeById(tx: Tx, id: string): Promise<boolean> {
    const rows = await tx
      .update(tenantInvitations)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(tenantInvitations.id, id),
          isNull(tenantInvitations.acceptedAt),
          isNull(tenantInvitations.revokedAt),
        ),
      )
      .returning({ id: tenantInvitations.id });

    return rows.length > 0;
  }

  /** Spends the invitation. `false` when another request got there first. */
  async markAccepted(tx: Tx, id: string): Promise<boolean> {
    const rows = await tx
      .update(tenantInvitations)
      .set({ acceptedAt: sql`now()` })
      .where(
        and(
          eq(tenantInvitations.id, id),
          isNull(tenantInvitations.acceptedAt),
          isNull(tenantInvitations.revokedAt),
        ),
      )
      .returning({ id: tenantInvitations.id });

    return rows.length > 0;
  }

  async tenantName(tx: Tx, tenantId: string): Promise<string | undefined> {
    const [row] = await tx
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return row?.name;
  }
}
