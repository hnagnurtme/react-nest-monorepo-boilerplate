import { Injectable } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { Tx } from '@/core/database/drizzle.module.js';
import { administrativeUnits, tenantDetails } from '@/core/database/schema/index.js';

/** A detail row joined to the names its two codes point at. */
export interface TenantDetailRow {
  tenantId: string;
  logoObjectKey: string | null;
  addressLine: string | null;
  wardCode: string | null;
  wardName: string | null;
  provinceCode: string | null;
  provinceName: string | null;
}

export interface TenantDetailPatch {
  logoObjectKey?: string | null;
  addressLine?: string | null;
  wardCode?: string | null;
  provinceCode?: string | null;
}

const ward = alias(administrativeUnits, 'ward');
const province = alias(administrativeUnits, 'province');

const columns = {
  tenantId: tenantDetails.tenantId,
  logoObjectKey: tenantDetails.logoObjectKey,
  addressLine: tenantDetails.addressLine,
  wardCode: tenantDetails.wardCode,
  wardName: ward.name,
  provinceCode: tenantDetails.provinceCode,
  provinceName: province.name,
};

/** Isolation is the RLS policy on `tenant_details`; never exported from the index. */
@Injectable()
export class TenantDetailsRepository {
  async findByTenantId(tx: Tx, tenantId: string): Promise<TenantDetailRow | undefined> {
    const [row] = await tx
      .select(columns)
      .from(tenantDetails)
      .leftJoin(ward, eq(ward.code, tenantDetails.wardCode))
      .leftJoin(province, eq(province.code, tenantDetails.provinceCode))
      .where(eq(tenantDetails.tenantId, tenantId))
      .limit(1);

    return row;
  }

  /** One query for a page of tenants, so the list does not fan out per row. */
  async listByTenantIds(tx: Tx, tenantIds: string[]): Promise<TenantDetailRow[]> {
    if (tenantIds.length === 0) return [];

    return tx
      .select(columns)
      .from(tenantDetails)
      .leftJoin(ward, eq(ward.code, tenantDetails.wardCode))
      .leftJoin(province, eq(province.code, tenantDetails.provinceCode))
      .where(inArray(tenantDetails.tenantId, tenantIds));
  }

  /**
   * Created on first write, not alongside the tenant: tenants that predate this
   * table have no row, and an upsert keeps "has no detail yet" and "is being
   * given one" the same code path.
   */
  async upsert(tx: Tx, tenantId: string, patch: TenantDetailPatch): Promise<void> {
    await tx
      .insert(tenantDetails)
      .values({ tenantId, ...patch })
      .onConflictDoUpdate({
        target: tenantDetails.tenantId,
        set: { ...patch, updatedAt: sql`now()` },
      });
  }
}
