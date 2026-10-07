import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';

import type { SortSpec } from '@/common/index.js';
import type { Tx } from '@/core/database/drizzle.module.js';
import { users, type NewUser, type User } from '@/core/database/schema/index.js';

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

  async softDelete(tx: Tx, id: string): Promise<boolean> {
    const rows = await tx
      .update(users)
      .set({ deletedAt: sql`now()`, isActive: false, updatedAt: sql`now()` })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning({ id: users.id });

    return rows.length > 0;
  }
}
