import type { Pool, PoolClient } from 'pg';

import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_LIST,
  permissionKey,
  type SystemRoleDefinition,
} from '@repo/shared-types';

/**
 * Brings `permissions`, the system roles and their grants in line with the code
 * (`PERMISSION_CATALOG` and `SYSTEM_ROLES` in shared-types). Idempotent, so it
 * is safe on every deploy and on a database that is already current.
 *
 * It runs from the migration job, never from app startup: with several API
 * replicas booting at once that would be a race (docs/rules/10-infra-devops.md).
 *
 * The statements go through the runtime role in 'admin' mode, the same path the
 * API itself uses, so no RLS bypass is needed. `app.system_roles_write` is the
 * one switch the immutability trigger on system roles accepts.
 */
export async function syncAuthzCatalog(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('RESET ROLE');
    await client.query('SET ROLE boilerplate_app');
    await client.query('BEGIN');
    await client.query(
      `SELECT set_config('app.access_mode', 'admin', true),
              set_config('app.tenant_id', '', true),
              set_config('app.system_roles_write', 'on', true)`,
    );

    await syncPermissions(client);
    for (const role of SYSTEM_ROLE_LIST) await syncSystemRole(client, role);

    await client.query('COMMIT');
  } catch (error: unknown) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.query('RESET ROLE').catch(() => undefined);
    client.release();
  }
}

type Client = PoolClient;

async function syncPermissions(client: Client): Promise<void> {
  for (const entry of PERMISSION_CATALOG) {
    await client.query(
      `INSERT INTO permissions (action, subject, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (action, subject) DO UPDATE SET description = EXCLUDED.description`,
      [entry.action, entry.subject, entry.description],
    );
  }

  // A permission dropped from the catalog disappears, and its grants with it.
  const keep = PERMISSION_CATALOG.map((e) => permissionKey(e.action, e.subject));
  await client.query(
    `DELETE FROM permissions WHERE (action || ':' || subject) <> ALL($1::text[])`,
    [keep],
  );
}

async function syncSystemRole(client: Client, role: SystemRoleDefinition): Promise<void> {
  await client.query(
    `INSERT INTO roles (id, tenant_id, key, name, scope, is_system)
     VALUES ($1, NULL, $2, $3, $4, true)
     ON CONFLICT (id) DO UPDATE SET key = EXCLUDED.key, name = EXCLUDED.name, scope = EXCLUDED.scope`,
    [role.id, role.key, role.name, role.scope],
  );

  const wanted = role.grants.map((g) => permissionKey(g.action, g.subject));
  await client.query(
    `DELETE FROM role_permissions rp USING permissions p
     WHERE rp.role_id = $1 AND rp.permission_id = p.id
       AND (p.action || ':' || p.subject) <> ALL($2::text[])`,
    [role.id, wanted],
  );

  for (const grant of role.grants) {
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id, scope_preset)
       SELECT $1, p.id, $4 FROM permissions p WHERE p.action = $2 AND p.subject = $3
       ON CONFLICT (role_id, permission_id) DO UPDATE SET scope_preset = EXCLUDED.scope_preset`,
      [role.id, grant.action, grant.subject, grant.preset],
    );
  }
}
