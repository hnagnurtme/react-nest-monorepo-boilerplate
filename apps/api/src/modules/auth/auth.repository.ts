import { Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';

import type { Tx } from '@/core/database/drizzle.module.js';
import {
  NewUser,
  sessions,
  tenants,
  users,
  type NewSession,
  type NewTenant,
  type Session,
  type Tenant,
  type User,
} from '@/core/database/schema/index.js';

/**
 * Data access for auth. Every method takes the `tx` its caller opened —
 * the transaction boundary belongs to the service, so that "verify the token,
 * mark it used and issue its replacement" is one atomic unit
 * (docs/rules/02-backend-nestjs.md D2).
 *
 * Never exported from the module's index: repositories are not a public
 * contract (docs/rules/02-backend-nestjs.md F2).
 */
@Injectable()
export class AuthRepository {
  async findUserByEmail(tx: Tx, email: string): Promise<User | undefined> {
    const [row] = await tx
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    return row;
  }

  async findActiveUserByEmail(tx: Tx, email: string): Promise<User | undefined> {
    const [row] = await tx
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.isActive, true), isNull(users.deletedAt)))
      .limit(1);

    return row;
  }

  async findActiveUserById(tx: Tx, id: string): Promise<User | undefined> {
    const [row] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.isActive, true), isNull(users.deletedAt)))
      .limit(1);

    return row;
  }

  async createTenant(tx: Tx, values: NewTenant): Promise<Tenant> {
    const [row] = await tx.insert(tenants).values(values).returning();
    if (row === undefined) throw new Error('Unable to create a new tenant.');
    return row;
  }

  // Register User
  async createUser(tx: Tx, values: NewUser): Promise<User> {
    const [row] = await tx.insert(users).values(values).returning();
    if (row === undefined) throw new Error('Unable to create a new account.');
    return row;
  }

  /**
   * Accepting an invitation sets the password and clears the "never signed in"
   * state in one statement, so a crash cannot leave a verified account with a
   * random password.
   */
  async activateInvitedUser(tx: Tx, userId: string, passwordHash: string): Promise<void> {
    await tx
      .update(users)
      .set({ passwordHash, isEmailVerified: true, updatedAt: sql`now()` })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));
  }

  async findTenantName(tx: Tx, tenantId: string): Promise<string | undefined> {
    const [row] = await tx
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return row?.name;
  }

  async updateUserPassword(tx: Tx, userId: string, passwordHash: string): Promise<void> {
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: sql`now()` })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));
  }

  async insertSession(tx: Tx, values: NewSession): Promise<Session> {
    const [row] = await tx.insert(sessions).values(values).returning();
    if (row === undefined) throw new Error('session insert returned no row');
    return row;
  }

  async findSessionByTokenHash(tx: Tx, tokenHash: string): Promise<Session | undefined> {
    const [row] = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);

    return row;
  }

  async markSessionUsed(tx: Tx, id: string): Promise<void> {
    await tx
      .update(sessions)
      .set({ usedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(sessions.id, id));
  }

  /** Revokes one login. Used both on logout and on reuse detection. */
  async revokeFamily(tx: Tx, familyId: string): Promise<void> {
    await tx
      .update(sessions)
      .set({ revokedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(sessions.familyId, familyId), isNull(sessions.revokedAt)));
  }

  /** Revokes every login of a user — "sign out on all devices". */
  async revokeAllForUser(tx: Tx, userId: string): Promise<void> {
    await tx
      .update(sessions)
      .set({ revokedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }
}
