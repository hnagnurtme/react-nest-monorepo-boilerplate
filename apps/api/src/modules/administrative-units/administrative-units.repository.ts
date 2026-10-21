import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';

import type { Tx } from '@/core/database/drizzle.module.js';
import { administrativeUnits, type AdministrativeUnit } from '@/core/database/schema/index.js';

/** Reference data, readable in every access mode; never exported from the index. */
@Injectable()
export class AdministrativeUnitsRepository {
  async listProvinces(tx: Tx): Promise<AdministrativeUnit[]> {
    return tx
      .select()
      .from(administrativeUnits)
      .where(eq(administrativeUnits.level, 'PROVINCE'))
      .orderBy(asc(administrativeUnits.code));
  }

  async listWards(tx: Tx, provinceCode: string): Promise<AdministrativeUnit[]> {
    return tx
      .select()
      .from(administrativeUnits)
      .where(eq(administrativeUnits.parentCode, provinceCode))
      .orderBy(asc(administrativeUnits.code));
  }

  async findByCode(tx: Tx, code: string): Promise<AdministrativeUnit | undefined> {
    const [row] = await tx
      .select()
      .from(administrativeUnits)
      .where(eq(administrativeUnits.code, code))
      .limit(1);

    return row;
  }
}
