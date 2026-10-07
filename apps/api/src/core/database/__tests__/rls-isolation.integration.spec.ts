import { randomUUID } from 'node:crypto';

import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getEnv } from '@/config/index.js';
import {
  ACCESS_MODE_SETTING,
  TENANT_SETTING,
  type AccessContext,
} from '@/core/database/request-context.js';

/**
 * These tests connect as the runtime role, never as the owner.
 *
 * Running them as the owner would make every assertion pass while proving
 * nothing: the owner is not subject to the policies (docs/rules/08-testing.md
 * C2). The first test below exists to make that mistake impossible to miss.
 */
const env = getEnv();

interface IdRow {
  id: string;
}

let appPool: Pool;
let ownerPool: Pool;

const tenantA = { id: randomUUID(), slug: `rls-a-${randomUUID()}` };
const tenantB = { id: randomUUID(), slug: `rls-b-${randomUUID()}` };
const userA = { id: randomUUID(), email: `a-${randomUUID()}@example.test` };
const userB = { id: randomUUID(), email: `b-${randomUUID()}@example.test` };

/** Runs `fn` in a rolled-back transaction carrying an explicit access context. */
async function withContext<T>(
  context: AccessContext,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true), set_config($3, $4, true)', [
      ACCESS_MODE_SETTING,
      context.accessMode,
      TENANT_SETTING,
      context.accessMode === 'tenant' ? context.tenantId : '',
    ]);
    return await fn(client);
  } finally {
    // Always roll back: a test must not leave rows behind for the next one.
    await client.query('ROLLBACK');
    client.release();
  }
}

/** The failure mode this whole design exists to prevent: no context at all. */
async function withoutContext<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    return await fn(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

beforeAll(async () => {
  appPool = new Pool({ connectionString: env.DATABASE_URL, max: 4 });
  ownerPool = new Pool({ connectionString: env.MIGRATION_DATABASE_URL, max: 1 });

  await ownerPool.query(
    `INSERT INTO tenants (id, name, slug) VALUES ($1, 'RLS A', $2), ($3, 'RLS B', $4)`,
    [tenantA.id, tenantA.slug, tenantB.id, tenantB.slug],
  );
  await ownerPool.query(
    `INSERT INTO users (id, email, password_hash, full_name, role, tenant_id)
     VALUES ($1, $2, 'x', 'A Admin', 'TENANT_ADMIN', $3), ($4, $5, 'x', 'B Admin', 'TENANT_ADMIN', $6)`,
    [userA.id, userA.email, tenantA.id, userB.id, userB.email, tenantB.id],
  );
});

afterAll(async () => {
  await ownerPool.query('DELETE FROM users WHERE id = ANY($1)', [[userA.id, userB.id]]);
  await ownerPool.query('DELETE FROM tenants WHERE id = ANY($1)', [[tenantA.id, tenantB.id]]);
  await Promise.all([appPool.end(), ownerPool.end()]);
});

describe('database roles', () => {
  it('the runtime role cannot bypass row level security', async () => {
    const { rows } = await appPool.query<{ rolbypassrls: boolean; current_user: string }>(
      'SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname = current_user',
    );

    expect(rows[0]?.rolbypassrls).toBe(false);
  });
});

describe('tenant isolation', () => {
  it('a tenant cannot read another tenant users', async () => {
    const rows = await withContext(
      { accessMode: 'tenant', tenantId: tenantA.id },
      async (client) =>
        (
          await client.query<IdRow>('SELECT id FROM users WHERE id = ANY($1)', [
            [userA.id, userB.id],
          ])
        ).rows,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: userA.id });
  });

  it('a tenant cannot update another tenant users', async () => {
    const rowCount = await withContext(
      { accessMode: 'tenant', tenantId: tenantA.id },
      async (client) =>
        (
          await client.query('UPDATE users SET full_name = $1 WHERE id = $2', [
            'hijacked',
            userB.id,
          ])
        ).rowCount,
    );

    // Not an error — the row is simply invisible, so there is nothing to update.
    expect(rowCount).toBe(0);
  });

  it('a tenant cannot insert a row belonging to another tenant', async () => {
    await expect(
      withContext({ accessMode: 'tenant', tenantId: tenantA.id }, async (client) =>
        client.query(
          `INSERT INTO users (email, password_hash, full_name, role, tenant_id)
           VALUES ($1, 'x', 'Smuggled', 'TENANT_MEMBER', $2)`,
          [`smuggled-${randomUUID()}@example.test`, tenantB.id],
        ),
      ),
    ).rejects.toThrow(/row-level security/iu);
  });
});

describe('tenants table', () => {
  it('a tenant sees only its own row', async () => {
    const rows = await withContext(
      { accessMode: 'tenant', tenantId: tenantA.id },
      async (client) =>
        (
          await client.query<IdRow>('SELECT id FROM tenants WHERE id = ANY($1)', [
            [tenantA.id, tenantB.id],
          ])
        ).rows,
    );

    expect(rows).toEqual([{ id: tenantA.id }]);
  });

  it('a tenant cannot create another tenant', async () => {
    await expect(
      withContext({ accessMode: 'tenant', tenantId: tenantA.id }, async (client) =>
        client.query(`INSERT INTO tenants (name, slug) VALUES ('Rogue', $1)`, [
          `rogue-${randomUUID()}`,
        ]),
      ),
    ).rejects.toThrow(/row-level security/iu);
  });
});

describe('admin access mode', () => {
  it('sees every tenant', async () => {
    const rows = await withContext(
      { accessMode: 'admin', reason: 'rls-test' },
      async (client) =>
        (
          await client.query<IdRow>('SELECT id FROM users WHERE id = ANY($1)', [
            [userA.id, userB.id],
          ])
        ).rows,
    );

    expect(rows).toHaveLength(2);
  });
});

describe('sessions table', () => {
  it('is invisible to a tenant context', async () => {
    const rows = await withContext(
      { accessMode: 'tenant', tenantId: tenantA.id },
      async (client) => (await client.query<IdRow>('SELECT id FROM sessions')).rows,
    );

    expect(rows).toHaveLength(0);
  });
});

describe('fail-closed', () => {
  it('returns no rows when no access mode was declared', async () => {
    const rows = await withoutContext(
      async (client) =>
        (
          await client.query<IdRow>('SELECT id FROM users WHERE id = ANY($1)', [
            [userA.id, userB.id],
          ])
        ).rows,
    );

    // Zero rows, not an error: the query is legal, it just matches nothing.
    // This is what makes a forgotten context a visible bug in a test rather
    // than an invisible leak in production.
    expect(rows).toHaveLength(0);
  });

  it('returns no rows for an unknown access mode', async () => {
    const rows = await withContext(
      { accessMode: 'nonsense' } as unknown as AccessContext,
      async (client) => (await client.query<IdRow>('SELECT id FROM tenants')).rows,
    );

    expect(rows).toHaveLength(0);
  });
});

describe('coverage', () => {
  /**
   * The scan from docs/02-backend-core-va-drizzle-rls.md 2.6, widened to every table. People forget;
   * this is the backstop that notices. It runs here rather than as a shell step
   * in CI so it also fails on a developer's machine, before the push.
   */
  it('every public table has RLS enabled and forced', async () => {
    const { rows } = await ownerPool.query<{ relname: string }>(`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND a.attnum = 1
        AND NOT a.attisdropped
        AND c.relname <> '__drizzle_migrations'
        AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)
    `);

    expect(rows.map((row) => row.relname)).toEqual([]);
  });

  it('no table carries more than one policy', async () => {
    // Postgres ORs PERMISSIVE policies together, so a second policy widens
    // access rather than narrowing it — the leak recorded in ADR 0003.
    const { rows } = await ownerPool.query<{ tablename: string; count: string }>(`
      SELECT tablename, count(*)::text AS count
      FROM pg_policies
      WHERE schemaname = 'public'
      GROUP BY tablename
      HAVING count(*) > 1
    `);

    expect(rows).toEqual([]);
  });
});
