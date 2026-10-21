import { sql } from 'drizzle-orm';
import { check, index, pgTable, text } from 'drizzle-orm/pg-core';

/**
 * Vietnam's administrative divisions as they stand after the 1 July 2025
 * merger: two levels, `PROVINCE` and `WARD`, with no district between them.
 *
 * A platform-wide catalog, like `permissions`: no `tenant_id`, readable in
 * every access mode, writable only in `admin` mode, and filled by the migration
 * job rather than by the API. The source dump lives in
 * `src/core/database/data/administrative-units.json` and is applied by
 * `syncAdministrativeUnits` from the migration job, so nothing reaches the
 * network at migrate time — CI has no outbound internet.
 *
 * Codes are zero-padded to their GSO width — two digits for a province, five
 * for a ward — because the upstream JSON carries them as integers, where ward
 * `00004` and province `04` would collide on a shared primary key.
 */
export const administrativeUnits = pgTable(
  'administrative_units',
  {
    /** The General Statistics Office code, e.g. `79` or `27028`, zero-padded. */
    code: text('code').primaryKey(),
    /** The name with its designation, as a picker shows it: `Phường Tân Phú`. */
    name: text('name').notNull(),
    /** The name an address line needs: `Phường Tân Phú, Thành phố Hồ Chí Minh`. */
    fullName: text('full_name').notNull(),
    /** `PROVINCE` | `WARD`. */
    level: text('level').notNull(),
    /** A ward's province; NULL on a province. The self FK is hand-written. */
    parentCode: text('parent_code'),
  },
  (table) => [
    index('ix_administrative_units_parent').on(table.parentCode),
    index('ix_administrative_units_level').on(table.level),
    check('ck_administrative_units_level', sql`${table.level} IN ('PROVINCE', 'WARD')`),
    /** A province has no parent; a ward always has one. */
    check(
      'ck_administrative_units_parent',
      sql`(${table.level} = 'PROVINCE') = (${table.parentCode} IS NULL)`,
    ),
  ],
);

export type AdministrativeUnit = typeof administrativeUnits.$inferSelect;
export type NewAdministrativeUnit = typeof administrativeUnits.$inferInsert;
