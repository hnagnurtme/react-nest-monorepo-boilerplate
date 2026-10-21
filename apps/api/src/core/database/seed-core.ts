import * as argon2 from 'argon2';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

import { SYSTEM_ROLES } from '@repo/shared-types';

import * as schema from './schema/index.js';

const ARGON2_TIME_COST = 2;
const ARGON2_PARALLELISM = 1;
export const SEED_PASSWORD = 'Password123!';
export const PLATFORM_ADMIN_EMAIL = 'admin@platform.com';

/**
 * Development seed. Runs as the migration role because it writes across every
 * tenant — the one thing the runtime role must never be able to do.
 *
 * Seeds the one account that cannot be created through the API (there is no
 * self sign-up) plus two empty tenants. Every other account is made from the
 * admin UI: the platform admin holds `manage:all`, so it creates tenants and
 * the first administrator of each.
 *
 * Idempotent: re-running it must not fail, or `just db-migrate && db-seed`
 * stops being something anyone is willing to type twice.
 */
export async function seedDevData(pool: Pool, memoryCost: number): Promise<void> {
  const db = drizzle(pool, { schema, casing: 'snake_case' });

  const passwordHash = await argon2.hash(SEED_PASSWORD, {
    type: argon2.argon2id,
    memoryCost,
    timeCost: ARGON2_TIME_COST,
    parallelism: ARGON2_PARALLELISM,
  });

  await db.transaction(async (tx) => {
    const tenantRows = await tx
      .insert(schema.tenants)
      .values([
        { name: 'Acme Inc.', slug: 'acme' },
        { name: 'Globex Corp.', slug: 'globex' },
      ])
      .onConflictDoUpdate({
        target: schema.tenants.slug,
        set: { updatedAt: sql`now()` },
      })
      .returning();

    if (tenantRows.length !== 2) throw new Error('tenant seed failed');

    // No tenant and no membership: a platform account sits above every tenant.
    const [admin] = await tx
      .insert(schema.users)
      .values({
        email: PLATFORM_ADMIN_EMAIL,
        fullName: 'Platform Admin',
        passwordHash,
        isActive: true,
        isEmailVerified: true,
      })
      // `targetWhere` matches the partial index `uq_users_email_active`:
      // ON CONFLICT infers an index, and a partial one is only inferred when
      // the predicate is repeated here.
      .onConflictDoUpdate({
        target: schema.users.email,
        targetWhere: sql`deleted_at IS NULL`,
        set: { passwordHash },
      })
      .returning();
    if (admin === undefined) throw new Error('admin seed failed');

    await tx
      .insert(schema.userRoles)
      .values({ userId: admin.id, roleId: SYSTEM_ROLES.PLATFORM_ADMIN.id })
      .onConflictDoNothing();
  });
}
