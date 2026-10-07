import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit runs as the owner role: it issues DDL, which the runtime app role
 * must never be able to do (docs/rules/03-database-drizzle.md F6).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/core/database/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env['MIGRATION_DATABASE_URL'] ?? '',
  },
  strict: true,
  verbose: true,
});
