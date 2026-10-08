import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getEnv } from '@/config/index.js';
import {
  ACCESS_MODE_SETTING,
  TENANT_SETTING,
  type AccessContext,
} from '@/core/database/request-context.js';
import * as schema from '@/core/database/schema/index.js';
import { UsersRepository } from '@/modules/users/users.repository.js';

/**
 * The search filter runs in the database, so the parts that can only break
 * there are covered here: ILIKE semantics, LIKE metacharacter escaping, the
 * soft-delete predicate, and — the one that matters — that a search can never
 * reach across tenants, because RLS still decides what the row set is.
 *
 * Connects as the app role (`DATABASE_URL`), never the owner: as the owner every
 * assertion would pass while the policy was broken (docs/rules/08-testing.md C2).
 */
const env = getEnv();

const repository = new UsersRepository();
const PAGE = { limit: 50, offset: 0 };

let appPool: Pool;
let ownerPool: Pool;

const tenantA = { id: randomUUID(), slug: `search-a-${randomUUID()}` };
const tenantB = { id: randomUUID(), slug: `search-b-${randomUUID()}` };

const adaA = { id: randomUUID(), email: `ada-${randomUUID()}@a.test`, name: 'Ada Lovelace' };
const graceA = { id: randomUUID(), email: `grace-${randomUUID()}@a.test`, name: 'Grace Hopper' };
const goneA = { id: randomUUID(), email: `gone-${randomUUID()}@a.test`, name: 'Ada Deleted' };
const oddA = { id: randomUUID(), email: `odd-${randomUUID()}@a.test`, name: 'Percent 100% Done' };
const adaB = { id: randomUUID(), email: `ada-${randomUUID()}@b.test`, name: 'Ada From B' };

/** Runs the repository inside a rolled-back transaction with an explicit context. */
async function search(context: AccessContext, term?: string): Promise<string[]> {
  const db = drizzle(appPool, { schema, casing: 'snake_case' });

  const names = await db.transaction(async (tx) => {
    const tenantId = context.accessMode === 'tenant' ? context.tenantId : '';
    // Parameterised, never interpolated: `is_local = true` scopes both settings
    // to this transaction, so the rollback below cannot leak them.
    await tx.execute(
      sql`SELECT set_config(${ACCESS_MODE_SETTING}, ${context.accessMode}, true),
                 set_config(${TENANT_SETTING}, ${tenantId}, true)`,
    );
    const rows = await repository.list(tx, PAGE, undefined, { search: term });
    const total = await repository.count(tx, { search: term });

    // The page and the count must agree, or meta.total lies to the client.
    expect(total).toBe(rows.length);
    return rows.map((row) => row.fullName);
  });

  return names.sort();
}

beforeAll(async () => {
  appPool = new Pool({ connectionString: env.DATABASE_URL, max: 4 });
  ownerPool = new Pool({ connectionString: env.MIGRATION_DATABASE_URL, max: 1 });

  await ownerPool.query(
    `INSERT INTO tenants (id, name, slug) VALUES ($1, 'Search A', $2), ($3, 'Search B', $4)`,
    [tenantA.id, tenantA.slug, tenantB.id, tenantB.slug],
  );
  // One transaction: `users` carries a deferred constraint trigger that checks
  // the membership row, so the two have to commit together.
  const setup = await ownerPool.connect();
  try {
    await setup.query('BEGIN');
    await setup.query(
      `INSERT INTO users (id, email, password_hash, full_name, tenant_id, deleted_at)
       VALUES ($1, $2, 'x', $3, $4, NULL),
              ($5, $6, 'x', $7, $8, NULL),
              ($9, $10, 'x', $11, $12, now()),
              ($13, $14, 'x', $15, $16, NULL),
              ($17, $18, 'x', $19, $20, NULL)`,
      [
        adaA.id,
        adaA.email,
        adaA.name,
        tenantA.id,
        graceA.id,
        graceA.email,
        graceA.name,
        tenantA.id,
        goneA.id,
        goneA.email,
        goneA.name,
        tenantA.id,
        oddA.id,
        oddA.email,
        oddA.name,
        tenantA.id,
        adaB.id,
        adaB.email,
        adaB.name,
        tenantB.id,
      ],
    );
    await setup.query(
      `INSERT INTO user_tenants (user_id, tenant_id)
       VALUES ($1, $5), ($2, $5), ($3, $5), ($4, $5), ($6, $7)`,
      [adaA.id, graceA.id, goneA.id, oddA.id, tenantA.id, adaB.id, tenantB.id],
    );
    await setup.query('COMMIT');
  } catch (error: unknown) {
    await setup.query('ROLLBACK');
    throw error;
  } finally {
    setup.release();
  }
});

afterAll(async () => {
  await ownerPool.query('DELETE FROM users WHERE tenant_id = ANY($1)', [[tenantA.id, tenantB.id]]);
  await ownerPool.query('DELETE FROM tenants WHERE id = ANY($1)', [[tenantA.id, tenantB.id]]);
  await Promise.all([appPool.end(), ownerPool.end()]);
});

describe('users search filter', () => {
  const inTenantA: AccessContext = { accessMode: 'tenant', tenantId: tenantA.id };
  const inTenantB: AccessContext = { accessMode: 'tenant', tenantId: tenantB.id };

  it('matches the name case-insensitively', async () => {
    await expect(search(inTenantA, 'ADA')).resolves.toEqual(['Ada Lovelace']);
    await expect(search(inTenantA, 'lovel')).resolves.toEqual(['Ada Lovelace']);
  });

  it('matches the email too', async () => {
    await expect(search(inTenantA, 'grace-')).resolves.toEqual(['Grace Hopper']);
  });

  it('never crosses a tenant boundary, even for an identical term', async () => {
    // "Ada" exists in both tenants; each side may only ever see its own.
    await expect(search(inTenantA, 'Ada')).resolves.toEqual(['Ada Lovelace']);
    await expect(search(inTenantB, 'Ada')).resolves.toEqual(['Ada From B']);
  });

  it('keeps soft-deleted rows out of the results', async () => {
    const all = await search(inTenantA);

    expect(all).not.toContain('Ada Deleted');
    expect(all).toEqual(['Ada Lovelace', 'Grace Hopper', 'Percent 100% Done']);
  });

  it('treats LIKE metacharacters as literal text', async () => {
    // Unescaped, '%' would match every row instead of the one containing it.
    await expect(search(inTenantA, '100%')).resolves.toEqual(['Percent 100% Done']);
    await expect(search(inTenantA, 'a%e')).resolves.toEqual([]);
    await expect(search(inTenantA, 'Ad_')).resolves.toEqual([]);
  });

  it('returns the whole tenant when no term is given', async () => {
    await expect(search(inTenantA)).resolves.toHaveLength(3);
    await expect(search(inTenantB)).resolves.toEqual(['Ada From B']);
  });
});
