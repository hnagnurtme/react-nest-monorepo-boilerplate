import * as argon2 from 'argon2';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { SYSTEM_ROLES } from '@repo/shared-types';

import { loadEnvFile, validateEnv } from '@/config/index.js';

import * as schema from './schema/index.js';

const ARGON2_TIME_COST = 2;
const ARGON2_PARALLELISM = 1;
const SEED_PASSWORD = 'Password123!';
const PLATFORM_ADMIN_EMAIL = 'admin@platform.com';

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
async function main(): Promise<void> {
  loadEnvFile();
  const env = validateEnv(process.env);

  const pool = new Pool({ connectionString: env.MIGRATION_DATABASE_URL, max: 1 });
  const db = drizzle(pool, { schema, casing: 'snake_case' });

  try {
    const passwordHash = await argon2.hash(SEED_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: env.ARGON2_MEMORY_COST,
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
        .onConflictDoUpdate({ target: schema.users.email, set: { passwordHash } })
        .returning();
      if (admin === undefined) throw new Error('admin seed failed');

      await tx
        .insert(schema.userRoles)
        .values({ userId: admin.id, roleId: SYSTEM_ROLES.PLATFORM_ADMIN.id })
        .onConflictDoNothing();
    });

    process.stdout.write(
      `Seeded. Sign in as ${PLATFORM_ADMIN_EMAIL} with the password: ${SEED_PASSWORD}\n`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Seed failed: ${String(error)}\n`);
  process.exit(1);
});
