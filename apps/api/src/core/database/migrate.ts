import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

import { loadEnvFile, validateEnv } from '@/config/index.js';

import { syncAuthzCatalog } from './authz-sync.js';

const readSql = (name: string): string =>
  readFileSync(resolve(import.meta.dirname, 'sql', name), 'utf8');

/**
 * Migration runner — the only place in the system allowed to issue DDL
 * (docs/rules/03-database-drizzle.md F6).
 *
 * `MIGRATION_DATABASE_URL` is a privileged connection (the `postgres`
 * superuser locally and in CI) because the first thing it has to do is create
 * the roles that do not exist yet. It then drops to `boilerplate_owner` for the
 * migrations themselves, so the tables end up owned by the role the RLS
 * policies were written against.
 */
async function main(): Promise<void> {
  loadEnvFile();
  const env = validateEnv(process.env);

  // max: 1 — `SET ROLE` is per-session, so every statement below must run on
  // the same connection.
  const pool = new Pool({ connectionString: env.MIGRATION_DATABASE_URL, max: 1 });

  try {
    // Roles first: the RLS policies name boilerplate_app in their `TO` clause,
    // so a migration would fail outright if the role did not exist yet.
    await pool.query(readSql('00-roles.sql'));
    await pool.query('SET ROLE boilerplate_owner');

    await migrate(drizzle(pool), {
      migrationsFolder: resolve(import.meta.dirname, '../../../drizzle'),
    });

    await pool.query(readSql('99-grants.sql'));

    await syncAuthzCatalog(pool);
    process.stdout.write('Migrations applied.\n');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Migration failed: ${String(error)}\n`);
  process.exit(1);
});
