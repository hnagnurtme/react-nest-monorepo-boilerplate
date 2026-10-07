import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';

import type { Tx } from '@/core/database/drizzle.module.js';
import { tenants, type NewTenant, type Tenant } from '@/core/database/schema/index.js';

export interface TenantPatch {
  name?: string;
  isActive?: boolean;
}

/** Isolation is the RLS policy on `tenants`; never export this class from the module index. */
@Injectable()
export class TenantsRepository {
  async list(tx: Tx, page: { limit: number; offset: number }): Promise<Tenant[]> {
    return tx
      .select()
      .from(tenants)
      .where(isNull(tenants.deletedAt))
      .orderBy(desc(tenants.createdAt), desc(tenants.id))
      .limit(page.limit)
      .offset(page.offset);
  }

  async count(tx: Tx): Promise<number> {
    const [row] = await tx
      .select({ total: count() })
      .from(tenants)
      .where(isNull(tenants.deletedAt));
    return row?.total ?? 0;
  }

  async findById(tx: Tx, id: string): Promise<Tenant | undefined> {
    const [row] = await tx
      .select()
      .from(tenants)
      .where(and(eq(tenants.id, id), isNull(tenants.deletedAt)))
      .limit(1);

    return row;
  }

  async create(tx: Tx, values: NewTenant): Promise<Tenant> {
    const [row] = await tx.insert(tenants).values(values).returning();
    if (row === undefined) throw new Error('tenant insert returned no row');
    return row;
  }

  async update(tx: Tx, id: string, patch: TenantPatch): Promise<Tenant | undefined> {
    const [row] = await tx
      .update(tenants)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(and(eq(tenants.id, id), isNull(tenants.deletedAt)))
      .returning();

    return row;
  }
}
