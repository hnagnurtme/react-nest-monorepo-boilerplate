import { Inject, Injectable } from '@nestjs/common';

import type { Tx } from '@/core/database/drizzle.module.js';
import type { AdministrativeUnit } from '@/core/database/schema/index.js';
import { TransactionManager } from '@/core/database/transaction.manager.js';
import { ResourceNotFoundError } from '@/core/errors/index.js';

import { AdministrativeUnitsRepository } from './administrative-units.repository.js';
import type { AdministrativeUnitResponse } from './administrative-units.types.js';

/**
 * Vietnam's divisions after the 1 July 2025 merger, as the tenant form needs
 * them. Read-only: the catalog is filled by the migration job from a
 * committed dump, so there is nothing to authorize.
 */
@Injectable()
export class AdministrativeUnitsService {
  constructor(
    @Inject(TransactionManager) private readonly transactions: TransactionManager,
    @Inject(AdministrativeUnitsRepository)
    private readonly repository: AdministrativeUnitsRepository,
  ) {}

  async listProvinces(): Promise<AdministrativeUnitResponse[]> {
    const rows = await this.transactions.runInRequestContext(async (tx) =>
      this.repository.listProvinces(tx),
    );

    return rows.map(toResponse);
  }

  async listWards(provinceCode: string): Promise<AdministrativeUnitResponse[]> {
    const rows = await this.transactions.runInRequestContext(async (tx) => {
      const province = await this.repository.findByCode(tx, provinceCode);
      // 404 rather than an empty list: a code that names nothing is a client
      // bug, and an empty array would read as "this province has no wards".
      if (province?.level !== 'PROVINCE') {
        throw new ResourceNotFoundError('AdministrativeUnit', provinceCode);
      }
      return this.repository.listWards(tx, provinceCode);
    });

    return rows.map(toResponse);
  }

  /**
   * What `TenantsService` needs to accept an address: the ward exists, it is a
   * ward, and it belongs to the province the caller named. A CHECK constraint
   * cannot do this — it may not read another table — so it happens here, inside
   * the caller's transaction.
   */
  async resolveWard(tx: Tx, wardCode: string): Promise<AdministrativeUnit | undefined> {
    const ward = await this.repository.findByCode(tx, wardCode);
    return ward?.level === 'WARD' ? ward : undefined;
  }
}

function toResponse(unit: AdministrativeUnit): AdministrativeUnitResponse {
  return {
    code: unit.code,
    name: unit.name,
    fullName: unit.fullName,
    parentCode: unit.parentCode,
  };
}
