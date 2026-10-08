import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { AppConfig } from '@/config/index.js';
import type { Tx } from '@/core/database/drizzle.module.js';
import type { TenantInvitationRow } from '@/core/database/schema/index.js';

import { TenantInvitationsRepository } from './tenant-invitations.repository.js';

const TOKEN_BYTES = 32;
const MS_PER_HOUR = 3_600_000;

/**
 * Mints and redeems the tokens behind tenant invitations.
 *
 * The plaintext token exists only in the email. This keeps the hashing in one
 * place so the issuing and the redeeming side cannot drift apart, and so the
 * token never reaches the repository.
 */
@Injectable()
export class TenantInvitationService {
  constructor(
    @Inject(TenantInvitationsRepository)
    private readonly repository: TenantInvitationsRepository,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}

  get ttlHours(): number {
    return this.config.invitationTtlHours;
  }

  /**
   * Replaces any live invitation for this account and tenant with a fresh one,
   * and returns the plaintext token — the only copy.
   */
  async issue(
    tx: Tx,
    invitation: { tenantId: string; userId: string; roleIds: string[]; invitedBy: string },
  ): Promise<string> {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');

    await this.repository.revokeLive(tx, invitation.tenantId, invitation.userId);
    await this.repository.create(tx, {
      ...invitation,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + this.ttlHours * MS_PER_HOUR),
    });

    return token;
  }

  /** The invitation a link stands for, without spending it. */
  async find(tx: Tx, token: string): Promise<TenantInvitationRow | undefined> {
    return this.repository.findLiveByTokenHash(tx, hash(token));
  }
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
