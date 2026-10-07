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

/**
 * Development seed. Runs as the migration role because it writes across every
 * tenant — the one thing the runtime role must never be able to do.
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

    const tenantRows = await db
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

    const [tenantA, tenantB] = tenantRows;
    if (tenantA === undefined || tenantB === undefined) throw new Error('tenant seed failed');

    const userRows = await db
      .insert(schema.users)
      .values(seedUsers(passwordHash, tenantA.id, tenantB.id))
      .onConflictDoUpdate({ target: schema.users.email, set: { passwordHash } })
      .returning();

    const roleByEmail = new Map<string, string>(SEED_ROLES.map(([email, role]) => [email, role]));
    const assignments = userRows.flatMap((user) => {
      const roleId = roleByEmail.get(user.email);
      return roleId === undefined ? [] : [{ userId: user.id, roleId, tenantId: user.tenantId }];
    });
    await db.insert(schema.userRoles).values(assignments).onConflictDoNothing();

    process.stdout.write(`Seeded. Every account uses the password: ${SEED_PASSWORD}\n`);
  } finally {
    await pool.end();
  }
}

/** Which system role each seed account holds. Role ids are fixed, see SYSTEM_ROLES. */
const SEED_ROLES: readonly (readonly [string, string])[] = [
  ['admin@example.com', SYSTEM_ROLES.PLATFORM_ADMIN.id],
  ['admin-a@example.com', SYSTEM_ROLES.TENANT_ADMIN.id],
  ['member-a@example.com', SYSTEM_ROLES.TENANT_MEMBER.id],
  ['admin-b@example.com', SYSTEM_ROLES.TENANT_ADMIN.id],
];

function seedUsers(
  passwordHash: string,
  tenantAId: string,
  tenantBId: string,
): (typeof schema.users.$inferInsert)[] {
  const verified = { passwordHash, isActive: true, isEmailVerified: true };

  return [
    { ...verified, email: 'admin@example.com', fullName: 'Platform Admin' },
    { ...verified, email: 'admin-a@example.com', fullName: 'Tenant A Admin', tenantId: tenantAId },
    {
      ...verified,
      email: 'member-a@example.com',
      fullName: 'Tenant A Member',
      tenantId: tenantAId,
    },
    { ...verified, email: 'admin-b@example.com', fullName: 'Tenant B Admin', tenantId: tenantBId },
  ];
}

main().catch((error: unknown) => {
  process.stderr.write(`Seed failed: ${String(error)}\n`);
  process.exit(1);
});
