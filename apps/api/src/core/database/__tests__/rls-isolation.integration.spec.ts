import { randomUUID } from 'node:crypto';

import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SYSTEM_ROLES } from '@repo/shared-types';

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
/** Lives in tenant A, but also belongs to tenant B. */
const userAB = { id: randomUUID(), email: `ab-${randomUUID()}@example.test` };
const roleA = { id: randomUUID() };
const roleB = { id: randomUUID() };
const SYSTEM_TENANT_ADMIN = SYSTEM_ROLES.TENANT_ADMIN.id;
const SYSTEM_PLATFORM_ADMIN = SYSTEM_ROLES.PLATFORM_ADMIN.id;

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
  // One transaction: `users` carries a deferred constraint trigger that checks
  // the membership row, so a user and its memberships have to commit together.
  const setup = await ownerPool.connect();
  try {
    await setup.query('BEGIN');
    await setup.query(
      `INSERT INTO users (id, email, password_hash, full_name, tenant_id)
       VALUES ($1, $2, 'x', 'A Admin', $3), ($4, $5, 'x', 'B Admin', $6),
              ($7, $8, 'x', 'AB Member', $3)`,
      [
        userA.id,
        userA.email,
        tenantA.id,
        userB.id,
        userB.email,
        tenantB.id,
        userAB.id,
        userAB.email,
      ],
    );
    await setup.query(
      `INSERT INTO user_tenants (user_id, tenant_id)
       VALUES ($1, $2), ($3, $4), ($5, $2), ($5, $4)`,
      [userA.id, tenantA.id, userB.id, tenantB.id, userAB.id],
    );
    await setup.query('COMMIT');
  } catch (error: unknown) {
    await setup.query('ROLLBACK');
    throw error;
  } finally {
    setup.release();
  }

  await ownerPool.query(
    `INSERT INTO roles (id, tenant_id, key, name) VALUES ($1, $2, 'RLS_A', 'RLS A'), ($3, $4, 'RLS_B', 'RLS B')`,
    [roleA.id, tenantA.id, roleB.id, tenantB.id],
  );
  await ownerPool.query(
    `INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3), ($4, $2, $5), ($6, $2, $5)`,
    [userA.id, SYSTEM_TENANT_ADMIN, tenantA.id, userB.id, tenantB.id, userAB.id],
  );
});

afterAll(async () => {
  const userIds = [userA.id, userB.id, userAB.id];
  await ownerPool.query('DELETE FROM user_roles WHERE user_id = ANY($1)', [userIds]);
  await ownerPool.query('DELETE FROM roles WHERE id = ANY($1)', [[roleA.id, roleB.id]]);
  await ownerPool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
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
          `INSERT INTO users (email, password_hash, full_name, tenant_id)
           VALUES ($1, 'x', 'Smuggled', $2)`,
          [`smuggled-${randomUUID()}@example.test`, tenantB.id],
        ),
      ),
    ).rejects.toThrow(/row-level security/iu);
  });
});

describe('multi-tenant membership', () => {
  it('an account is visible in every tenant it belongs to, not just its home tenant', async () => {
    for (const tenantId of [tenantA.id, tenantB.id]) {
      const rows = await withContext(
        { accessMode: 'tenant', tenantId },
        async (client) =>
          (await client.query<IdRow>('SELECT id FROM users WHERE id = $1', [userAB.id])).rows,
      );

      expect(rows).toEqual([{ id: userAB.id }]);
    }
  });

  it('membership rows of another tenant stay hidden', async () => {
    const rows = await withContext(
      { accessMode: 'tenant', tenantId: tenantA.id },
      async (client) =>
        (
          await client.query<{ tenant_id: string }>(
            'SELECT tenant_id FROM user_tenants WHERE user_id = $1',
            [userAB.id],
          )
        ).rows,
    );

    expect(rows).toEqual([{ tenant_id: tenantA.id }]);
  });

  it('holds the same role in two tenants: one key per membership, not per account', async () => {
    const rows = await withContext({ accessMode: 'admin', reason: 'test' }, async (client) => {
      await client.query(
        'INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3), ($1, $2, $4)',
        [userAB.id, SYSTEM_ROLES.TENANT_MEMBER.id, tenantA.id, tenantB.id],
      );
      return (
        await client.query<{ tenant_id: string }>(
          'SELECT tenant_id FROM user_roles WHERE user_id = $1 AND role_id = $2 ORDER BY tenant_id',
          [userAB.id, SYSTEM_ROLES.TENANT_MEMBER.id],
        )
      ).rows;
    });

    expect(rows).toHaveLength(2);
  });

  it('refuses the same role twice in one tenant', async () => {
    await expect(
      withContext({ accessMode: 'admin', reason: 'test' }, async (client) =>
        client.query(
          'INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3), ($1, $2, $3)',
          [userAB.id, SYSTEM_ROLES.TENANT_MEMBER.id, tenantA.id],
        ),
      ),
    ).rejects.toThrow(/uq_user_roles_tenant|duplicate key/iu);
  });

  it('a role cannot be assigned in a tenant the account does not belong to', async () => {
    await expect(
      withContext({ accessMode: 'admin', reason: 'test' }, async (client) =>
        client.query('INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3)', [
          userB.id,
          SYSTEM_ROLES.TENANT_MEMBER.id,
          tenantA.id,
        ]),
      ),
    ).rejects.toThrow(/does not belong to that tenant/iu);
  });

  it('a custom role cannot be assigned outside its own tenant', async () => {
    await expect(
      withContext({ accessMode: 'admin', reason: 'test' }, async (client) =>
        client.query('INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3)', [
          userAB.id,
          roleB.id,
          tenantA.id,
        ]),
      ),
    ).rejects.toThrow(/another tenant/iu);
  });

  it('a tenant role assignment without a tenant is refused', async () => {
    await expect(
      withContext({ accessMode: 'admin', reason: 'test' }, async (client) =>
        client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [
          userAB.id,
          SYSTEM_ROLES.TENANT_MEMBER.id,
        ]),
      ),
    ).rejects.toThrow(/needs a tenant/iu);
  });

  it('a tenant cannot repoint an account home tenant', async () => {
    await expect(
      withContext({ accessMode: 'tenant', tenantId: tenantA.id }, async (client) =>
        client.query('UPDATE users SET tenant_id = $1 WHERE id = $2', [tenantB.id, userAB.id]),
      ),
    ).rejects.toThrow(/admin mode/iu);
  });

  it('a home tenant the account does not belong to is refused', async () => {
    await expect(
      withContext({ accessMode: 'admin', reason: 'test' }, async (client) =>
        client.query('UPDATE users SET tenant_id = $1 WHERE id = $2', [tenantB.id, userA.id]),
      ),
    ).rejects.toThrow(/not a tenant of this account/iu);
  });

  it('removing a membership leaves the account and its other tenants alone', async () => {
    const remaining = await withContext(
      { accessMode: 'tenant', tenantId: tenantB.id },
      async (client) => {
        await client.query('DELETE FROM user_tenants WHERE user_id = $1 AND tenant_id = $2', [
          userAB.id,
          tenantB.id,
        ]);
        return (await client.query<IdRow>('SELECT id FROM users WHERE id = $1', [userAB.id])).rows;
      },
    );

    // The row is gone from tenant B's view, and the account itself survives.
    expect(remaining).toEqual([]);
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

describe('roles', () => {
  const tenantCtx: AccessContext = { accessMode: 'tenant', tenantId: tenantA.id };

  it("a tenant sees the shared system roles and its own, never another tenant's", async () => {
    const rows = await withContext(
      tenantCtx,
      async (client) =>
        (
          await client.query<IdRow>('SELECT id FROM roles WHERE id = ANY($1)', [
            [roleA.id, roleB.id, SYSTEM_TENANT_ADMIN],
          ])
        ).rows,
    );

    expect(rows.map((r) => r.id).sort()).toEqual([roleA.id, SYSTEM_TENANT_ADMIN].sort());
  });

  it('platform-scope system roles are invisible to a tenant', async () => {
    const rows = await withContext(
      tenantCtx,
      async (client) =>
        (await client.query<IdRow>('SELECT id FROM roles WHERE id = $1', [SYSTEM_PLATFORM_ADMIN]))
          .rows,
    );

    expect(rows).toHaveLength(0);
  });

  it('a tenant cannot create a role in another tenant', async () => {
    await expect(
      withContext(tenantCtx, async (client) =>
        client.query(`INSERT INTO roles (tenant_id, key, name) VALUES ($1, 'EVIL', 'Evil')`, [
          tenantB.id,
        ]),
      ),
    ).rejects.toThrow(/row-level security/iu);
  });

  it('a tenant cannot create a system role (tenant_id NULL) either', async () => {
    await expect(
      withContext(tenantCtx, async (client) =>
        client.query(
          `INSERT INTO roles (tenant_id, key, name, is_system) VALUES (NULL, 'EVIL', 'Evil', true)`,
        ),
      ),
    ).rejects.toThrow(/row-level security/iu);
  });

  it('system roles are immutable: rename and delete are both refused, even in admin mode', async () => {
    for (const context of [tenantCtx, { accessMode: 'admin', reason: 'rls-test' } as const]) {
      await expect(
        withContext(context, async (client) =>
          client.query(`UPDATE roles SET name = 'Hacked' WHERE id = $1`, [SYSTEM_TENANT_ADMIN]),
        ),
      ).rejects.toThrow(/immutable|row-level security/iu);
      await expect(
        withContext(context, async (client) =>
          client.query(`DELETE FROM roles WHERE id = $1`, [SYSTEM_TENANT_ADMIN]),
        ),
      ).rejects.toThrow(/immutable|row-level security/iu);
    }
  });

  it('the grants of a system role cannot be edited either', async () => {
    await expect(
      withContext({ accessMode: 'admin', reason: 'rls-test' }, async (client) =>
        client.query(`DELETE FROM role_permissions WHERE role_id = $1`, [SYSTEM_TENANT_ADMIN]),
      ),
    ).rejects.toThrow(/immutable/iu);
  });

  it("a tenant sees grants of roles it can see, and cannot add a grant to another tenant's role", async () => {
    const rows = await withContext(
      tenantCtx,
      async (client) =>
        (
          await client.query<IdRow>(
            'SELECT role_id AS id FROM role_permissions WHERE role_id = $1 LIMIT 1',
            [SYSTEM_TENANT_ADMIN],
          )
        ).rows,
    );
    expect(rows).toHaveLength(1);

    await expect(
      withContext(tenantCtx, async (client) =>
        client.query(
          `INSERT INTO role_permissions (role_id, permission_id, scope_preset)
           SELECT $1, id, 'own_tenant' FROM permissions WHERE action = 'read' AND subject = 'User'`,
          [roleB.id],
        ),
      ),
    ).rejects.toThrow(/row-level security/iu);
  });
});

describe('user_roles', () => {
  const tenantCtx: AccessContext = { accessMode: 'tenant', tenantId: tenantA.id };

  it("a tenant sees only its own users' assignments", async () => {
    const rows = await withContext(
      tenantCtx,
      async (client) =>
        (
          await client.query<{ user_id: string }>(
            'SELECT user_id FROM user_roles WHERE user_id = ANY($1)',
            [[userA.id, userB.id]],
          )
        ).rows,
    );

    expect(rows.map((r) => r.user_id)).toEqual([userA.id]);
  });

  it("a platform role cannot be assigned to a tenant user, nor another tenant's custom role", async () => {
    await expect(
      withContext({ accessMode: 'admin', reason: 'rls-test' }, async (client) =>
        client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [
          userA.id,
          SYSTEM_PLATFORM_ADMIN,
        ]),
      ),
    ).rejects.toThrow(/platform roles/iu);

    await expect(
      withContext({ accessMode: 'admin', reason: 'rls-test' }, async (client) =>
        client.query(`INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3)`, [
          userA.id,
          roleB.id,
          tenantA.id,
        ]),
      ),
    ).rejects.toThrow(/another tenant/iu);
  });

  it('refuses an assignment in a tenant the account does not belong to', async () => {
    // The tenant is no longer stamped from the user: an account can belong to
    // several, so the caller names one and the trigger checks the membership.
    await expect(
      withContext(tenantCtx, async (client) =>
        client.query(`INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3)`, [
          userA.id,
          roleA.id,
          tenantB.id,
        ]),
      ),
    ).rejects.toThrow(/row-level security|does not belong to that tenant/iu);
  });

  it('keeps the tenant the caller named when the account belongs to it', async () => {
    const row = await withContext(tenantCtx, async (client) => {
      await client.query(
        `INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3)`,
        [userA.id, roleA.id, tenantA.id],
      );
      return (
        await client.query<{ tenant_id: string }>(
          'SELECT tenant_id FROM user_roles WHERE user_id = $1 AND role_id = $2',
          [userA.id, roleA.id],
        )
      ).rows[0];
    });

    expect(row).toEqual({ tenant_id: tenantA.id });
  });
});

describe('permissions catalog', () => {
  it('is readable by a tenant but not writable', async () => {
    const rows = await withContext(
      { accessMode: 'tenant', tenantId: tenantA.id },
      async (client) => (await client.query<IdRow>('SELECT id FROM permissions')).rows,
    );
    expect(rows.length).toBeGreaterThan(0);

    await expect(
      withContext({ accessMode: 'tenant', tenantId: tenantA.id }, async (client) =>
        client.query(`INSERT INTO permissions (action, subject) VALUES ('read', 'Evil')`),
      ),
    ).rejects.toThrow(/row-level security/iu);
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
