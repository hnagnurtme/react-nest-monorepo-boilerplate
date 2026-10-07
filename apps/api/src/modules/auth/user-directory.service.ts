import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { slugify } from '@/common/index.js';
import type { User } from '@/core/database/schema/index.js';
import { TransactionManager } from '@/core/database/transaction.manager.js';
import {
  InvalidCredentialsError,
  ResourceConflictError,
  ResourceNotFoundError,
} from '@/core/errors/index.js';

import { AuthRepository } from './auth.repository.js';
import type { PublicUser } from './auth.types.js';
import { CredentialsService } from './credentials.service.js';
import type { LoginDto, RegisterDto } from './dto/index.js';

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
    return toPublicUser(user);
  }

  async findActive(userId: string): Promise<PublicUser | undefined> {
    const user = await this.transactions.run(
      { accessMode: 'admin', reason: 'auth:profile' },
      async (tx) => this.repository.findActiveUserById(tx, userId),
    );

    return user === undefined ? undefined : toPublicUser(user);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.transactions.run(
      { accessMode: 'admin', reason: 'auth:find-by-email' },
      async (tx) => this.repository.findUserByEmail(tx, email),
    );
  }

  /**
   * Account register flow
   * 1. Check email exist:
   * - If email exists and is verified => throw Conflict error
   * - If email exists but is not verified => update existing account
   * - If email does not exist => create new account
   *
   */
  async registerUser(dto: RegisterDto): Promise<PublicUser> {
    const passwordHash = await this.credentials.hash(dto.password);

    const user = await this.transactions.run(
      { accessMode: 'admin', reason: 'auth:register-user' },
      async (tx) => {
        const existing = await this.repository.findUserByEmail(tx, dto.email);

        if (existing !== undefined) {
          // Case 1: Account is already verified => throw error duplicate
          if (existing.isEmailVerified) {
            throw new ResourceConflictError('**This email address is already registered.');
          }

          // Case 2: The account was registered but the OTP has not been verified yet -> Update the account information.
          return this.repository.updateUnverifiedUser(tx, existing.id, {
            fullName: dto.fullName,
            phoneNumber: dto.phoneNumber,
            passwordHash,
          });
        }

        // Case 3: Account does not exist => create the tenant it will own, then
        // the account as that tenant's first admin.
        const tenant = await this.repository.createTenant(tx, {
          name: `${dto.fullName}'s workspace`,
          slug: buildTenantSlug(dto.fullName),
        });

        return this.repository.createUser(tx, {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          phoneNumber: dto.phoneNumber,
          role: 'TENANT_ADMIN',
          tenantId: tenant.id,
          isActive: false,
          isEmailVerified: false,
        });
      },
    );

    return toPublicUser(user);
  }

  /**
   * Activate accoung by email and
   */
  async activateEmail(email: string): Promise<PublicUser> {
    const user = await this.transactions.run(
      { accessMode: 'admin', reason: 'auth:activate-email' },
      async (tx) => {
        const existing = await this.repository.findUserByEmail(tx, email);
        if (!existing) {
          throw new ResourceNotFoundError('Account', email);
        }
        if (existing.isEmailVerified) {
          throw new ResourceConflictError('Account is already verified.');
        }

        return this.repository.verifyUserEmail(tx, email);
      },
    );

    return toPublicUser(user);
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
}

/**
 * Built by whitelist rather than by deleting fields from the row: a column
 * added next year would otherwise leak by default
 * (docs/rules/06-api-design.md C6).
 */
function toPublicUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  tenantId: string | null;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as PublicUser['role'],
    tenantId: user.tenantId ?? undefined,
  };
}

/** A random suffix keeps two people with the same name from colliding on the unique slug. */
function buildTenantSlug(fullName: string): string {
  const base = slugify(fullName) || 'workspace';
  return `${base}-${randomBytes(3).toString('hex')}`;
}
