import { Pool } from 'pg';

import { loadEnvFile, validateEnv } from '@/config/index.js';

import { PLATFORM_ADMIN_EMAIL, SEED_PASSWORD, seedDevData } from './seed-core.js';

/**
 * `just db-seed`. The seeding itself lives in `seed-core.ts`, which runs no
 * code on import: `reset.ts` needs the function, and a module that seeds the
 * moment it is imported would seed while the reset was still truncating —
 * which it did, as a deadlock between the two connections.
 */
async function main(): Promise<void> {
  loadEnvFile();
  const env = validateEnv(process.env);

  const pool = new Pool({ connectionString: env.MIGRATION_DATABASE_URL, max: 1 });

  try {
    await seedDevData(pool, env.ARGON2_MEMORY_COST);
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
