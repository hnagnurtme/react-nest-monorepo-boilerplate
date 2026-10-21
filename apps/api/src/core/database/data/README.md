# `core/database/data`

Reference data the migration job loads into code-owned catalogs. Each file is a
committed dump, not a call to a live service: CI has no outbound internet, and a
list that changes under a running migration is worse than one that changes in a
review.

## `administrative-units.json`

Vietnam's administrative divisions as they stand after the **1 July 2025
merger**: two levels — `PROVINCE` (34 of them) and `WARD` — with no district
level in between.

| Field        | Meaning                                                                       |
| :----------- | :---------------------------------------------------------------------------- |
| `code`       | General Statistics Office code, zero-padded: 2 digits province, 5 digits ward |
| `name`       | Name with its designation, as a picker shows it (`Phường Tân Phú`)            |
| `fullName`   | Name with its province, for an address line                                   |
| `level`      | `PROVINCE` or `WARD`                                                          |
| `parentCode` | The ward's province; `null` on a province                                     |

**Source:** the public dataset published at
[provinces.open-api.vn](https://provinces.open-api.vn) (`/api/v2/?depth=2`),
which republishes the GSO list. The dump was fetched once, normalised to the
fields above and committed.

Codes are zero-padded because the upstream payload carries them as integers,
where ward `00004` and province `04` would collide on a shared primary key.

**Refreshing it** (after a future merger): re-fetch, normalise to the same
shape, commit the diff, then run `just db-migrate`. `syncAdministrativeUnits`
(`core/database/administrative-units-sync.ts`) upserts every row, deletes the
ones the dump no longer lists — wards before provinces, for the self FK — and
refuses a dump whose wards name a province it does not contain, so a bad file
fails the migration rather than a form at 3am.

The sync runs from the migration job, never at app startup: several API
replicas booting at once would race, and the catalog has to exist in production,
which `just db-seed` never touches.
