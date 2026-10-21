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
import type { Tx } from '@/core/database/drizzle.module.js';
import type { Tenant } from '@/core/database/schema/index.js';
import { TransactionManager } from '@/core/database/transaction.manager.js';
import {
  ForbiddenActionError,
  InvalidInputError,
  ResourceNotFoundError,
} from '@/core/errors/index.js';
import {
  IMAGE_CONTENT_TYPES,
  StorageService,
  tenantLogoPrefix,
  type ImageContentType,
} from '@/integrations/storage/index.js';
import { AdministrativeUnitsService } from '@/modules/administrative-units/index.js';

import type { CreateTenantDto, UpdateTenantDto } from './dto/index.js';
import {
  TenantDetailsRepository,
  type TenantDetailPatch,
  type TenantDetailRow,
} from './tenant-details.repository.js';
import { TenantsRepository } from './tenants.repository.js';
import type { LogoUploadResponse, TenantDetailResponse, TenantResponse } from './tenants.types.js';

/** What a `detail` block in a request body looks like once Zod is done with it. */
type DetailInput = NonNullable<UpdateTenantDto['detail']>;

@Injectable()
export class TenantsService {
  constructor(
    @Inject(TransactionManager) private readonly transactions: TransactionManager,
    @Inject(TenantsRepository) private readonly repository: TenantsRepository,
    @Inject(TenantDetailsRepository) private readonly details: TenantDetailsRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(AuthzService) private readonly authz: AuthzService,
    @Inject(AdministrativeUnitsService) private readonly units: AdministrativeUnitsService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  async list(query: PageQuery): Promise<{ items: TenantResponse[]; meta: PaginationMeta }> {
    const [rows, total, details] = await this.transactions.runInRequestContext(async (tx) => {
      const [page, count] = await Promise.all([
        this.repository.list(tx, {
          limit: query.limit,
          offset: toOffset(query.page, query.limit),
        }),
        this.repository.count(tx),
      ]);
      // One query for the page, not one per row.
      const detailRows = await this.details.listByTenantIds(
        tx,
        page.map((tenant) => tenant.id),
      );
      return [page, count, detailRows] as const;
    });

    const byTenant = new Map(details.map((row) => [row.tenantId, row]));

    return {
      items: await Promise.all(rows.map(async (row) => this.toResponse(row, byTenant.get(row.id)))),
      meta: buildPaginationMeta(query, total),
    };
  }

  /**
   * The tenant picker, answered before a tenant has been chosen — hence the
   * `admin`-mode transaction of its own: the caller has no access context yet.
   *
   * A platform account is a member of nothing and may act in any tenant, so it
   * gets every active one; everybody else gets their memberships.
   */
  async listMine(actor: AuthContext): Promise<TenantResponse[]> {
    const ids = actor.scope === 'platform' ? null : actor.tenantIds;

    const { rows, details } = await this.transactions.run(
      { accessMode: 'admin', reason: 'tenants:picker' },
      async (tx) => {
        const page = await this.repository.listForPicker(tx, ids);
        const detailRows = await this.details.listByTenantIds(
          tx,
          page.map((tenant) => tenant.id),
        );
        return { rows: page, details: detailRows };
      },
    );

    const byTenant = new Map(details.map((row) => [row.tenantId, row]));

    return Promise.all(
      rows.map(async (tenant) => this.toResponse(tenant, byTenant.get(tenant.id))),
    );
  }

  async findOrThrow(id: string): Promise<TenantResponse> {
    const tenant = await this.loadOrThrow(id);
    this.assertCan('read', tenant);

    const detail = await this.transactions.runInRequestContext(async (tx) =>
      this.details.findByTenantId(tx, id),
    );

    return this.toResponse(tenant, detail);
  }

  /** Only a platform admin (`manage all`) holds the `create` ability on Tenant. */
  async create(actor: AuthContext, dto: CreateTenantDto): Promise<TenantResponse> {
    if (!this.authz.current().can('create', 'Tenant')) {
      throw new ForbiddenActionError('create', 'Tenant');
    }

    const { tenant, detail } = await this.transactions.runInRequestContext(async (tx) => {
      const row = await this.repository.create(tx, { name: dto.name, slug: dto.slug });

      if (dto.detail !== undefined) {
        await this.details.upsert(tx, row.id, await this.resolveDetail(tx, row.id, dto.detail));
      }
      const detailRow = await this.details.findByTenantId(tx, row.id);

      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId: row.id,
        action: 'tenant.create',
        resourceType: 'Tenant',
        resourceId: row.id,
        afterState: auditSnapshot(row, detailRow),
      });
      return { tenant: row, detail: detailRow };
    });

    return this.toResponse(tenant, detail);
  }

  async update(actor: AuthContext, id: string, dto: UpdateTenantDto): Promise<TenantResponse> {
    const existing = await this.loadOrThrow(id);
    this.assertCan('update', existing);
    // Switching a tenant on or off is a platform decision, not a tenant one.
    if (dto.isActive !== undefined && actor.scope !== 'platform') {
      throw new ForbiddenActionError('update', 'Tenant');
    }

    const result = await this.transactions.runInRequestContext(async (tx) => {
      const before = await this.details.findByTenantId(tx, id);

      const hasTenantPatch = dto.name !== undefined || dto.isActive !== undefined;
      const row = hasTenantPatch
        ? await this.repository.update(tx, id, {
            ...(dto.name === undefined ? {} : { name: dto.name }),
            ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
          })
        : existing;
      if (row === undefined) return undefined;

      if (dto.detail !== undefined) {
        await this.details.upsert(tx, id, await this.resolveDetail(tx, id, dto.detail));
      }
      const after = await this.details.findByTenantId(tx, id);

      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId: row.id,
        action: 'tenant.update',
        resourceType: 'Tenant',
        resourceId: id,
        beforeState: auditSnapshot(existing, before),
        afterState: auditSnapshot(row, after),
      });
      return { tenant: row, before, after };
    });
    if (result === undefined) throw new ResourceNotFoundError('Tenant', id);

    // The tenant's existence flag and its members' profiles both describe this
    // row. Switching it off drops it from every membership, and a cached
    // profile would keep offering it in the picker for the rest of the TTL.
    await this.authz.invalidateTenant(id);

    // After the commit, and never fatal: the row already points at the new
    // logo, so failing the request over a leftover object would be worse than
    // the object. A replaced key is unreachable either way — the bucket is
    // private and nothing but this column names it.
    const replaced = result.before?.logoObjectKey ?? null;
    if (replaced !== null && replaced !== (result.after?.logoObjectKey ?? null)) {
      await this.storage.deleteQuietly(replaced);
    }

    return this.toResponse(result.tenant, result.after);
  }

  /**
   * Signs a PUT the browser uses to upload straight to the bucket. The file
   * never passes through NestJS; `update` then confirms the key, which is what
   * stops a caller from storing a key it never uploaded to.
   */
  async signLogoUpload(id: string, contentType: ImageContentType): Promise<LogoUploadResponse> {
    const tenant = await this.loadOrThrow(id);
    this.assertCan('update', tenant);

    return this.storage.signUpload(this.storage.buildTenantLogoKey(id, contentType), contentType);
  }

  /**
   * Turns a request's `detail` block into columns, rejecting anything the
   * database cannot check for itself.
   *
   * Two things no constraint covers: a ward has to sit in the province the
   * caller named (a CHECK may not read another table), and a logo key has to
   * name an object that exists, is an image, and is within the size ceiling —
   * the presigned PUT signs the content type but not the length.
   */
  private async resolveDetail(
    tx: Tx,
    tenantId: string,
    detail: DetailInput,
  ): Promise<TenantDetailPatch> {
    const patch: TenantDetailPatch = {};

    if (detail.addressLine !== undefined) patch.addressLine = detail.addressLine;

    if (detail.wardCode !== undefined) {
      const wardCode = detail.wardCode;
      if (wardCode === null) {
        patch.wardCode = null;
        patch.provinceCode = null;
      } else {
        const ward = await this.units.resolveWard(tx, wardCode);
        if (ward === undefined) throw new InvalidInputError(`Unknown ward ${wardCode}`);
        if (ward.parentCode !== detail.provinceCode) {
          throw new InvalidInputError(
            `Ward ${wardCode} is not in province ${detail.provinceCode ?? 'none'}`,
          );
        }
        patch.wardCode = ward.code;
        patch.provinceCode = ward.parentCode;
      }
    }

    if (detail.logoObjectKey !== undefined) {
      patch.logoObjectKey =
        detail.logoObjectKey === null
          ? null
          : await this.confirmLogo(tenantId, detail.logoObjectKey);
    }

    return patch;
  }

  private async confirmLogo(tenantId: string, objectKey: string): Promise<string> {
    // The prefix is the authorization: a signed PUT grants exactly one key, and
    // a key under another tenant's prefix was never one this caller was given.
    if (!objectKey.startsWith(tenantLogoPrefix(tenantId))) {
      throw new InvalidInputError('The logo key does not belong to this tenant');
    }

    const stored = await this.storage.head(objectKey);
    if (stored === null) throw new InvalidInputError('No object was uploaded under that key');

    const contentType = stored.contentType ?? '';
    if (!isImageContentType(contentType)) {
      throw new InvalidInputError(`A logo cannot be ${contentType || 'of an unknown type'}`);
    }

    // Read off the signer, so the ceiling the browser was handed and the one
    // enforced here cannot drift apart.
    const { maxUploadBytes } = this.storage;
    if ((stored.contentLength ?? 0) > maxUploadBytes) {
      throw new InvalidInputError(`A logo may not exceed ${String(maxUploadBytes)} bytes`);
    }

    return objectKey;
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

  private async toResponse(
    tenant: Tenant,
    detail: TenantDetailRow | undefined,
  ): Promise<TenantResponse> {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt.toISOString(),
      detail: await this.toDetailResponse(detail),
    };
  }

  private async toDetailResponse(
    detail: TenantDetailRow | undefined,
  ): Promise<TenantDetailResponse | null> {
    if (detail === undefined) return null;

    const logoUrl =
      detail.logoObjectKey === null || !this.storage.isEnabled
        ? null
        : await this.storage.signDownload(detail.logoObjectKey);

    return {
      logoUrl,
      addressLine: detail.addressLine,
      wardCode: detail.wardCode,
      wardName: detail.wardName,
      provinceCode: detail.provinceCode,
      provinceName: detail.provinceName,
      fullAddress: fullAddress(detail),
    };
  }
}

function isImageContentType(value: string): value is ImageContentType {
  return (IMAGE_CONTENT_TYPES as readonly string[]).includes(value);
}

/** Street, ward and province joined for display; null unless all parts exist. */
function fullAddress(detail: TenantDetailRow): string | null {
  const parts = [detail.addressLine, detail.wardName, detail.provinceName];
  return parts.every((part) => part !== null && part !== '') ? parts.join(', ') : null;
}

/**
 * What the audit log keeps of a tenant. The object key rather than a signed
 * URL: the URL expires, and a snapshot that cannot be compared later is noise.
 */
function auditSnapshot(
  tenant: Tenant,
  detail: TenantDetailRow | undefined,
): Record<string, unknown> {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    isActive: tenant.isActive,
    detail:
      detail === undefined
        ? null
        : {
            logoObjectKey: detail.logoObjectKey,
            addressLine: detail.addressLine,
            wardCode: detail.wardCode,
            provinceCode: detail.provinceCode,
          },
  };
}
