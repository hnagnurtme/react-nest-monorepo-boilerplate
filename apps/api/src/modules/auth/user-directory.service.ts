import { Inject, Injectable } from '@nestjs/common';

import type { AuthzProfile } from '@/core/authz/index.js';
import { AuthzService } from '@/core/authz/index.js';
import type { User } from '@/core/database/schema/index.js';
import { TransactionManager } from '@/core/database/transaction.manager.js';
import { InvalidCredentialsError, ResourceNotFoundError } from '@/core/errors/index.js';

import { AuthRepository } from './auth.repository.js';
import type { PublicUser } from './auth.types.js';
import { CredentialsService } from './credentials.service.js';
import type { LoginDto } from './dto/index.js';

/**
 * User lookups for the auth flow.
 *
 * Every query runs in 'admin' mode with an explicit reason, because at login
 * time there is no session to derive a tenant from — the lookup is
 * cross-tenant by definition. The reason string is what keeps that visible in
 * the logs instead of convenient and silent.
 */
@Injectable()
export class UserDirectory {
  constructor(
    @Inject(TransactionManager) private readonly transactions: TransactionManager,
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(CredentialsService) private readonly credentials: CredentialsService,
    @Inject(AuthzService) private readonly authz: AuthzService,
  ) {}

  async authenticate(dto: LoginDto): Promise<PublicUser> {
    await this.credentials.assertAttemptsRemaining(dto.email);

    const user = await this.transactions.run(
      { accessMode: 'admin', reason: 'auth:login' },
      async (tx) => this.repository.findActiveUserByEmail(tx, dto.email),
    );

    if (!(await this.credentials.matches(user?.passwordHash, dto.password))) {
      throw new InvalidCredentialsError();
    }
    if (user === undefined) throw new InvalidCredentialsError();

    await this.credentials.clearAttempts(dto.email);
    return this.toPublicUser(user);
  }

  async findActive(userId: string): Promise<PublicUser | undefined> {
    const user = await this.transactions.run(
      { accessMode: 'admin', reason: 'auth:profile' },
      async (tx) => this.repository.findActiveUserById(tx, userId),
    );

    return user === undefined ? undefined : this.toPublicUser(user);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.transactions.run(
      { accessMode: 'admin', reason: 'auth:find-by-email' },
      async (tx) => this.repository.findUserByEmail(tx, email),
    );
  }

  /**
   * Reset password for an account (called after OTP is verified)
   */
  async resetPassword(email: string, newPassword: string): Promise<string> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new ResourceNotFoundError('Account', email);
    }

    const passwordHash = await this.credentials.hash(newPassword);

    await this.transactions.run(
      { accessMode: 'admin', reason: 'auth:reset-password' },
      async (tx) => this.repository.updateUserPassword(tx, user.id, passwordHash),
    );

    return user.id;
  }

  /**
   * Change password for currently authenticated user
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.transactions.run(
      { accessMode: 'admin', reason: 'auth:change-password-check' },
      async (tx) => this.repository.findActiveUserById(tx, userId),
    );

    if (!user) throw new ResourceNotFoundError('Account');

    const isMatched = await this.credentials.matches(user.passwordHash, currentPassword);
    if (!isMatched) {
      throw new InvalidCredentialsError();
    }

    const newPasswordHash = await this.credentials.hash(newPassword);

    await this.transactions.run(
      { accessMode: 'admin', reason: 'auth:change-password-save' },
      async (tx) => this.repository.updateUserPassword(tx, userId, newPasswordHash),
    );
  }

  /**
   * Built by whitelist rather than by deleting fields from the row: a column
   * added next year would otherwise leak by default
   * (docs/rules/06-api-design.md C6). Roles and scope come from the authz
   * profile, the same source the guards use on every request.
   */
  private async toPublicUser(user: User): Promise<PublicUser> {
    const profile = await this.authz.loadProfile(user.id);
    if (profile === undefined) throw new InvalidCredentialsError();

    return publicUserFrom(user, profile);
  }
}

function publicUserFrom(
  user: Pick<User, 'id' | 'email' | 'fullName' | 'tenantId'>,
  profile: AuthzProfile,
): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    tenantId: user.tenantId ?? undefined,
    scope: profile.scope,
    roles: profile.roles.map((role) => ({ key: role.key, name: role.name })),
  };
}
