import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { administrativeUnits } from './administrative-units.js';
import { tenants } from './tenants.js';

/**
 * What a tenant shows on the tenant picker — a logo and a postal address — kept out of
 * `tenants` because `tenants` is the isolation root and every RLS policy in
 * the schema reads it.
 *
 * One row per tenant, enforced by the primary key *being* the foreign key: no
 * surrogate `id`, so a second row is impossible rather than merely unexpected.
 * `ON DELETE CASCADE` rather than the `RESTRICT` the business tables use —
 * business tables carry records that must not vanish with their tenant, while
 * this row is the tenant's own description and is meaningless without it.
 *
 * The row is created lazily: tenants that predate this table have none, and the
 * API answers `detail: null` for them until someone fills the form in.
 */
export const tenantDetails = pgTable(
  'tenant_details',
  {
    tenantId: uuid('tenant_id')
      .primaryKey()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Object key in the private bucket, never a URL: a presigned URL expires. */
    logoObjectKey: text('logo_object_key'),
    /** House number and street — the part no catalog can supply. */
    addressLine: text('address_line'),
    wardCode: text('ward_code').references(() => administrativeUnits.code),
    /**
     * Denormalised from the ward's parent so grouping tenants by province on
     * the picker map is one index scan rather than a join through the catalog.
     * The service checks the pair agrees; a CHECK cannot read another table.
     */
    provinceCode: text('province_code').references(() => administrativeUnits.code),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ix_tenant_details_province').on(table.provinceCode),
    /** Half an address is worse than none: both codes travel together. */
    check(
      'ck_tenant_details_ward_pair',
      sql`(${table.wardCode} IS NULL) = (${table.provinceCode} IS NULL)`,
    ),
  ],
);

export type TenantDetail = typeof tenantDetails.$inferSelect;
export type NewTenantDetail = typeof tenantDetails.$inferInsert;
