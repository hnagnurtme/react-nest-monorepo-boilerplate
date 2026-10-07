import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import type { ClientInfo } from '@/common/index.js';
import type { Tx } from '@/core/database/drizzle.module.js';
import type { Session } from '@/core/database/schema/index.js';
import { TransactionManager } from '@/core/database/transaction.manager.js';
import { RefreshTokenInvalidError, TokenReuseDetectedError } from '@/core/errors/index.js';

import { AuthRepository } from './auth.repository.js';
import type { PublicUser } from './auth.types.js';
import { TokenService, type IssuedRefreshToken } from './token.service.js';
import { UserDirectory } from './user-directory.service.js';

export interface IssuedSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshTtlMs: number;
}

export interface IssueRequest {
  user: PublicUser;
  client: ClientInfo;
  /** Omitted on a fresh login; a rotation continues its predecessor's family. */
  previous?: Session;
}

type RotationOutcome =
  | { kind: 'rotated'; userId: string; session: Session }
  | { kind: 'reuse'; familyId: string; userId: string };

/**
 * The lifecycle of a login: issue a token pair, rotate it, revoke it.
 *
 * Transaction boundaries live here rather than in the repository, so that
 * "verify the token, mark it spent and record its replacement" is one
 * indivisible step (docs/rules/02-backend-nestjs.md D2).
 */
@Injectable()
export class SessionService {
  // Property injection: the logger is cross-cutting and would otherwise push
  // the constructor past the three-parameter limit for no design benefit.
  @Inject(PinoLogger) private readonly logger!: PinoLogger;

  constructor(
    @Inject(TransactionManager) private readonly transactions: TransactionManager,
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(UserDirectory) private readonly directory: UserDirectory,
  ) {}

  async issue(request: IssueRequest): Promise<IssuedSession> {
    const access = await this.tokens.issueAccessToken(request.user);
    const refresh = this.tokens.issueRefreshToken();

    await this.transactions.run({ accessMode: 'admin', reason: 'auth:issue-session' }, async (tx) =>
      this.repository.insertSession(tx, this.sessionRow(request, refresh)),
    );

    return {
      user: request.user,
      accessToken: access.token,
      refreshToken: refresh.token,
      refreshTtlMs: this.tokens.refreshTtlMs,
    };
  }

  issueCsrfToken(): string {
    return this.tokens.issueCsrfToken();
  }

  /** Retires the caller's current access token instead of waiting it out. */
  async revokeAccessToken(jti: string): Promise<void> {
    await this.tokens.revokeAccessToken(jti);
  }

  /**
   * Spends a refresh token and issues its replacement.
   *
   * A token arriving twice means it leaked (or a client retried a request whose
   * response never arrived); the safe answer to both is to revoke the entire
   * family (docs/03-auth-flow-va-casl-abac.md 1.3).
   */
  async rotate(presentedToken: string | undefined, client: ClientInfo): Promise<IssuedSession> {
    if (presentedToken === undefined) throw new RefreshTokenInvalidError();
    const tokenHash = this.tokens.hashRefreshToken(presentedToken);

    const outcome = await this.transactions.run(
      { accessMode: 'admin', reason: 'auth:refresh' },
      async (tx) => this.consume(tx, tokenHash),
    );

    if (outcome.kind === 'reuse') {
      await this.handleReuse(outcome.familyId, outcome.userId, client);
      throw new TokenReuseDetectedError();
    }

    const user = await this.directory.findActive(outcome.userId);
    if (user === undefined) throw new RefreshTokenInvalidError();

    return this.issue({ user, client, previous: outcome.session });
  }

  /** Ends the one login a refresh token belongs to. */
  async revokeByRefreshToken(presentedToken: string | undefined): Promise<void> {
    if (presentedToken === undefined) return;
    const tokenHash = this.tokens.hashRefreshToken(presentedToken);

    await this.transactions.run({ accessMode: 'admin', reason: 'auth:logout' }, async (tx) => {
      const session = await this.repository.findSessionByTokenHash(tx, tokenHash);
      if (session !== undefined) await this.repository.revokeFamily(tx, session.familyId);
    });
  }

  /** Ends every login of a user — the "someone has my password" button. */
  async revokeEverySession(userId: string): Promise<void> {
    await this.transactions.run({ accessMode: 'admin', reason: 'auth:logout-all' }, async (tx) =>
      this.repository.revokeAllForUser(tx, userId),
    );
  }

  private sessionRow(
    request: IssueRequest,
    refresh: IssuedRefreshToken,
  ): Parameters<AuthRepository['insertSession']>[1] {
    return {
      userId: request.user.id,
      familyId: request.previous?.familyId ?? randomUUID(),
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
      ...(request.previous === undefined ? {} : { parentId: request.previous.id }),
      ...(request.client.userAgent === undefined ? {} : { userAgent: request.client.userAgent }),
      ...(request.client.ipAddress === undefined ? {} : { ipAddress: request.client.ipAddress }),
    };
  }

  private async consume(tx: Tx, tokenHash: string): Promise<RotationOutcome> {
    const session = await this.repository.findSessionByTokenHash(tx, tokenHash);
    if (session === undefined) throw new RefreshTokenInvalidError();

    if (session.usedAt !== null) {
      return { kind: 'reuse', familyId: session.familyId, userId: session.userId };
    }

    if (session.revokedAt !== null || session.expiresAt.getTime() <= Date.now()) {
      throw new RefreshTokenInvalidError();
    }

    const user = await this.repository.findActiveUserById(tx, session.userId);
    if (user === undefined) throw new RefreshTokenInvalidError();

    await this.repository.markSessionUsed(tx, session.id);

    return { kind: 'rotated', userId: user.id, session };
  }

  private async handleReuse(familyId: string, userId: string, client: ClientInfo): Promise<void> {
    // Its own committed transaction, deliberately. Revoking inside the
    // transaction above and then throwing would roll the revocation back along
    // with the error — the reuse would be detected and then forgiven.
    await this.transactions.run({ accessMode: 'admin', reason: 'auth:reuse-revoke' }, async (tx) =>
      this.repository.revokeFamily(tx, familyId),
    );

    this.logger.warn(
      { userId, familyId, ip: client.ipAddress, userAgent: client.userAgent },
      'Refresh token reuse detected; revoked session family',
    );
  }
}
