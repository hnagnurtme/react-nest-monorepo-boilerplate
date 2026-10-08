import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';

import type { SortSpec } from '@/common/index.js';
import type { Tx } from '@/core/database/drizzle.module.js';
import {
  tenants,
  users,
  userTenants,
  type NewUser,
  type User,
} from '@/core/database/schema/index.js';

export const USER_SORT_FIELDS = ['createdAt', 'fullName', 'email'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export interface UserFilter {
  /** Case-insensitive substring of the full name or the email. */
  search?: string | undefined;
}

export interface UserPatch {
  fullName?: string;
  phoneNumber?: string | null;
  isActive?: boolean;
}

/**
 * Binding the term as a parameter stops SQL injection but not LIKE
 * metacharacters: without this, a search for `a%` would match everything after
 * an `a`. Backslash is Postgres' default LIKE escape character.
 */
function escapeLikePattern(value: string): string {
  return value.replaceAll(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * Soft-deleted rows are always excluded. The leading `%` means this predicate
 * cannot use a b-tree index: add a trigram index (`pg_trgm`) if the table grows
 * past a few thousand rows.
 */
function listWhere(filter: UserFilter): SQL | undefined {
  const notDeleted = isNull(users.deletedAt);
  if (filter.search === undefined || filter.search === '') return notDeleted;

  const pattern = `%${escapeLikePattern(filter.search)}%`;
  return and(notDeleted, or(ilike(users.fullName, pattern), ilike(users.email, pattern)));
}

/**
 * No tenant filter appears in any query below: tenant isolation is enforced by
 * the RLS policy on `users`, not by application code (ADR-0003). Never export
 * this class from the module index.
 */
@Injectable()
export class UsersRepository {
  async findTenantName(tx: Tx, tenantId: string): Promise<string | undefined> {
    const [row] = await tx
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return row?.name;
  }

  async list(
    tx: Tx,
    page: { limit: number; offset: number },
    sort: SortSpec<UserSortField> | undefined,
    filter: UserFilter = {},
  ): Promise<User[]> {
    const column = users[sort?.field ?? 'createdAt'];
    const order = sort?.direction === 'asc' ? asc(column) : desc(column);

    return tx
      .select()
      .from(users)
      .where(listWhere(filter))
      .orderBy(order, desc(users.id))
      .limit(page.limit)
      .offset(page.offset);
  }

  /** Counted with the same predicate as `list`, or the page meta would not match. */
  async count(tx: Tx, filter: UserFilter = {}): Promise<number> {
    const [row] = await tx.select({ total: count() }).from(users).where(listWhere(filter));
    return row?.total ?? 0;
  }

  async findById(tx: Tx, id: string): Promise<User | undefined> {
    const [row] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    return row;
  }

  async create(tx: Tx, values: NewUser): Promise<User> {
    const [row] = await tx.insert(users).values(values).returning();
    if (row === undefined) throw new Error('user insert returned no row');
    return row;
  }

  async update(tx: Tx, id: string, patch: UserPatch): Promise<User | undefined> {
    const [row] = await tx
      .update(users)
      .set({
        ...patch,
        updatedAt: sql`now()`,
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();

    return row;
  }

  /**
   * The account behind an email, across every tenant. Callers pass an
   * `admin`-mode transaction: an email is one account platform-wide, so
   * "does this email exist" cannot be answered from inside a single tenant.
   */
  async findByEmail(tx: Tx, email: string): Promise<User | undefined> {
    const [row] = await tx
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    return row;
  }

  /** Lets an account act in a tenant. Idempotent, so re-adding a member is not an error. */
  async addMembership(tx: Tx, userId: string, tenantId: string): Promise<void> {
    await tx.insert(userTenants).values({ userId, tenantId }).onConflictDoNothing();
  }

  async removeMembership(tx: Tx, userId: string, tenantId: string): Promise<boolean> {
    const rows = await tx
      .delete(userTenants)
      .where(and(eq(userTenants.userId, userId), eq(userTenants.tenantId, tenantId)))
      .returning({ tenantId: userTenants.tenantId });

    return rows.length > 0;
  }

  /** Tenant ids the account belongs to, as far as the caller may see them. */
  async membershipIds(tx: Tx, userId: string): Promise<string[]> {
    const rows = await tx
      .select({ tenantId: userTenants.tenantId })
      .from(userTenants)
      .where(eq(userTenants.userId, userId));

    return rows.map((row) => row.tenantId);
  }

  async softDelete(tx: Tx, id: string): Promise<boolean> {
    const rows = await tx
      .update(users)
      .set({ deletedAt: sql`now()`, isActive: false, updatedAt: sql`now()` })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });

    return rows.length > 0;
  }
}
