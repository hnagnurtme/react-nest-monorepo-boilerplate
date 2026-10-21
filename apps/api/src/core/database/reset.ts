import { Pool } from 'pg';

import { loadEnvFile, validateEnv } from '@/config/index.js';

import { syncAuthzCatalog } from './authz-sync.js';
import { PLATFORM_ADMIN_EMAIL, SEED_PASSWORD, seedDevData } from './seed-core.js';

/**
 * Development reset: empties every table in `public`, re-syncs the catalogs the
 * migration job owns (permissions, system roles) and seeds the platform admin
 * again.
 *
 * It is not a migration: the schema is left exactly as it is, so a reset never
 * needs `drizzle` to run first and the migration journal in the `drizzle`
 * schema is never touched.
 *
 * Refuses to run against `NODE_ENV=production` and needs `--yes`, because a
 * truncate cannot be undone.
 */
const CONFIRM_FLAG = '--yes';

/**
 * Every Redis key the API owns. The reset wipes these rather than `FLUSHDB`: a
 * developer machine often has one Redis shared with other projects, and the
 * cached authz profiles would otherwise outlive the accounts they describe by
 * up to their 300 s TTL.
 */
const REDIS_PREFIXES = ['authz:profile:', 'authz:tenant:', 'auth:'];

async function truncatePublicTables(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );
  const tables = rows.map((row) => row.table_name);
  if (tables.length === 0) return [];

  const list = tables.map((name) => `public."${name}"`).join(', ');
  // CASCADE because the tables reference each other; RESTART IDENTITY so a
  // reset database looks like a fresh one.
  await pool.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  return tables;
}

async function clearRedis(url: string): Promise<number> {
  const { Redis } = await import('ioredis');
  const redis = new Redis(url, { maxRetriesPerRequest: 2 });

  try {
    let removed = 0;
    for (const prefix of REDIS_PREFIXES) {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 500);
        cursor = next;
        if (keys.length > 0) removed += await redis.del(...keys);
      } while (cursor !== '0');
    }
    return removed;
  } finally {
    redis.disconnect();
  }
}

async function main(): Promise<void> {
  loadEnvFile();
  const env = validateEnv(process.env);

  if (env.NODE_ENV === 'production') {
    throw new Error('refusing to reset a production database');
  }
  if (!process.argv.includes(CONFIRM_FLAG)) {
    throw new Error(
      `this deletes every row in every table. Re-run with ${CONFIRM_FLAG} to confirm.`,
    );
  }

  // max: 1 — `SET ROLE` is per-session, exactly as in migrate.ts.
  const pool = new Pool({ connectionString: env.MIGRATION_DATABASE_URL, max: 1 });

  try {
    await pool.query('SET ROLE boilerplate_owner');
    const tables = await truncatePublicTables(pool);
    process.stdout.write(`Truncated ${String(tables.length)} tables.\n`);

    // The catalog lives in code and is written by the migration job, so a
    // truncate has to put it back before anything can authorize a request.
    await pool.query('RESET ROLE');
    await syncAuthzCatalog(pool);

    // The seed stays on the superuser connection: `FORCE ROW LEVEL SECURITY`
    // subjects even the owning role to the policies, so an owner-role insert
    // across tenants writes nothing.
    await seedDevData(pool, env.ARGON2_MEMORY_COST);
  } finally {
    await pool.end();
  }

  const removed = await clearRedis(env.REDIS_URL);
  process.stdout.write(
    `Reset done. Cleared ${String(removed)} Redis keys. Sign in as ${PLATFORM_ADMIN_EMAIL} with the password: ${SEED_PASSWORD}\n`,
  );
}

main().catch((error: unknown) => {
  // Drizzle wraps the driver error, and the Postgres message is the only part
  // that says which policy or trigger refused the write.
  const cause = error instanceof Error ? error.cause : undefined;
  process.stderr.write(`Reset failed: ${String(error)}\n`);
  if (cause instanceof Error) process.stderr.write(`Cause: ${cause.message}\n`);
  process.exit(1);
});
