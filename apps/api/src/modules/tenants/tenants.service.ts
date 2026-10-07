import { subject } from '@casl/ability';
import { Inject, Injectable } from '@nestjs/common';

import type { Action } from '@repo/shared-types';

import {
  buildPaginationMeta,
  toOffset,
  type AuthContext,
  type PageQuery,
  type PaginationMeta,
} from '@/common/index.js';
import { AuditService } from '@/core/audit/audit.service.js';
import { AuthzService } from '@/core/authz/index.js';
import type { Tenant } from '@/core/database/schema/index.js';
import { TransactionManager } from '@/core/database/transaction.manager.js';
import { ForbiddenActionError, ResourceNotFoundError } from '@/core/errors/index.js';

import type { CreateTenantDto, UpdateTenantDto } from './dto/index.js';
import { TenantsRepository } from './tenants.repository.js';
import type { TenantResponse } from './tenants.types.js';

@Injectable()
export class TenantsService {
  constructor(
    @Inject(TransactionManager) private readonly transactions: TransactionManager,
    @Inject(TenantsRepository) private readonly repository: TenantsRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AuthzService) private readonly authz: AuthzService,
  ) {}

  async list(query: PageQuery): Promise<{ items: TenantResponse[]; meta: PaginationMeta }> {
    const [rows, total] = await this.transactions.runInRequestContext(async (tx) =>
      Promise.all([
        this.repository.list(tx, {
          limit: query.limit,
          offset: toOffset(query.page, query.limit),
        }),
        this.repository.count(tx),
      ]),
    );

    return { items: rows.map(toTenantResponse), meta: buildPaginationMeta(query, total) };
  }

  async findOrThrow(id: string): Promise<TenantResponse> {
    const tenant = await this.loadOrThrow(id);
    this.assertCan('read', tenant);

    return toTenantResponse(tenant);
  }

  /** Only a platform admin (`manage all`) holds the `create` ability on Tenant. */
  async create(actor: AuthContext, dto: CreateTenantDto): Promise<TenantResponse> {
    if (!this.authz.current().can('create', 'Tenant')) {
      throw new ForbiddenActionError('create', 'Tenant');
    }

    const created = await this.transactions.runInRequestContext(async (tx) => {
      const row = await this.repository.create(tx, { name: dto.name, slug: dto.slug });
      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId: row.id,
        action: 'tenant.create',
        resourceType: 'Tenant',
        resourceId: row.id,
        afterState: toTenantResponse(row),
      });
      return row;
    });

    return toTenantResponse(created);
  }

  async update(actor: AuthContext, id: string, dto: UpdateTenantDto): Promise<TenantResponse> {
    const existing = await this.loadOrThrow(id);
    this.assertCan('update', existing);
    // Switching a tenant on or off is a platform decision, not a tenant one.
    if (dto.isActive !== undefined && actor.scope !== 'platform') {
      throw new ForbiddenActionError('update', 'Tenant');
    }

    const updated = await this.transactions.runInRequestContext(async (tx) => {
      const row = await this.repository.update(tx, id, {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
      });
      if (row === undefined) return undefined;
      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId: row.id,
        action: 'tenant.update',
        resourceType: 'Tenant',
        resourceId: id,
        beforeState: toTenantResponse(existing),
        afterState: toTenantResponse(row),
      });
      return row;
    });
    if (updated === undefined) throw new ResourceNotFoundError('Tenant', id);

    return toTenantResponse(updated);
  }

  private async loadOrThrow(id: string): Promise<Tenant> {
    const tenant = await this.transactions.runInRequestContext(async (tx) =>
      this.repository.findById(tx, id),
    );
    if (tenant === undefined) throw new ResourceNotFoundError('Tenant', id);

    return tenant;
  }

  /** Layer 2: a bare `'Tenant'` string would ignore every condition (see CheckPolicies). */
  private assertCan(action: Action, tenant: Tenant): void {
    if (!this.authz.current().can(action, subject('Tenant', { id: tenant.id }))) {
      throw new ForbiddenActionError(action, 'Tenant');
    }
  }
}

function toTenantResponse(tenant: Tenant): TenantResponse {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    isActive: tenant.isActive,
    createdAt: tenant.createdAt.toISOString(),
  };
}
