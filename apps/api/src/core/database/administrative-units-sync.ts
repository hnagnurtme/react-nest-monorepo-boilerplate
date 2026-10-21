import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';

/**
 * Brings `administrative_units` in line with the dump in
 * `data/administrative-units.json`. Idempotent, the same shape as
 * `syncAuthzCatalog`.
 *
 * It runs from the migration job, never from app startup: several API replicas
 * booting at once would race, and the catalog has to exist in production, which
 * `just db-seed` never touches.
 *
 * The dump is a committed file rather than a call to provinces.open-api.vn: CI
 * has no outbound internet, the API publishes no SLA, and a division list that
 * changes under a running migration is worse than one that changes in a review.
 * Refresh it by re-running the fetch, committing the diff, and re-migrating.
 */
const unitSchema = z
  .object({
    code: z.string().min(1),
    name: z.string().min(1),
    fullName: z.string().min(1),
    level: z.enum(['PROVINCE', 'WARD']),
    parentCode: z.string().min(1).nullable(),
  })
  .strict();

type AdministrativeUnitSeed = z.infer<typeof unitSchema>;

const loadDump = (): AdministrativeUnitSeed[] => {
  const path = resolve(import.meta.dirname, 'data', 'administrative-units.json');
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return z.array(unitSchema).parse(parsed);
};

export async function syncAdministrativeUnits(pool: Pool): Promise<void> {
  const units = loadDump();
  assertDumpIsConsistent(units);

  const client = await pool.connect();

  try {
    await client.query('RESET ROLE');
    await client.query('SET ROLE boilerplate_app');
    await client.query('BEGIN');
    await client.query(
      `SELECT set_config('app.access_mode', 'admin', true),
              set_config('app.tenant_id', '', true)`,
    );

    // Provinces first: a ward's FK points at one, and the whole sync is one
    // transaction, so a reordering inside it would still fail on insert.
    const provinces = units.filter((unit) => unit.level === 'PROVINCE');
    const wards = units.filter((unit) => unit.level === 'WARD');
    for (const unit of [...provinces, ...wards]) await upsert(client, unit);

    // Wards before provinces on the way out, for the same FK.
    await client.query(
      `DELETE FROM administrative_units
        WHERE level = 'WARD' AND code <> ALL($1::text[])`,
      [wards.map((unit) => unit.code)],
    );
    await client.query(
      `DELETE FROM administrative_units
        WHERE level = 'PROVINCE' AND code <> ALL($1::text[])`,
      [provinces.map((unit) => unit.code)],
    );

    await client.query('COMMIT');
  } catch (error: unknown) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.query('RESET ROLE').catch(() => undefined);
    client.release();
  }
}

async function upsert(client: PoolClient, unit: AdministrativeUnitSeed): Promise<void> {
  await client.query(
    `INSERT INTO administrative_units (code, name, full_name, level, parent_code)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name,
            full_name = EXCLUDED.full_name,
            level = EXCLUDED.level,
            parent_code = EXCLUDED.parent_code`,
    [unit.code, unit.name, unit.fullName, unit.level, unit.parentCode],
  );
}

/**
 * Fail the migration, not a form at 3am: a dump whose wards point at provinces
 * it does not contain would leave the tenant picker with unresolvable codes.
 */
function assertDumpIsConsistent(units: AdministrativeUnitSeed[]): void {
  const codes = new Set<string>();
  for (const unit of units) {
    if (codes.has(unit.code)) throw new Error(`Duplicate administrative unit code ${unit.code}`);
    codes.add(unit.code);
  }

  const provinces = new Set(units.filter((u) => u.level === 'PROVINCE').map((u) => u.code));
  for (const unit of units) {
    if (unit.level === 'PROVINCE') {
      if (unit.parentCode !== null) throw new Error(`Province ${unit.code} has a parent`);
      continue;
    }
    if (unit.parentCode === null) throw new Error(`Ward ${unit.code} has no province`);
    if (!provinces.has(unit.parentCode)) {
      throw new Error(`Ward ${unit.code} names unknown province ${unit.parentCode}`);
    }
  }
}
