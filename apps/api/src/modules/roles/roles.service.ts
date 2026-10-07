import { subject } from '@casl/ability';
import { Inject, Injectable } from '@nestjs/common';

import {
  PERMISSION_CATALOG,
  findCatalogEntry,
  grantsCover,
  permissionKey,
  type Action,
  type PermissionGrant,
} from '@repo/shared-types';

import {
  buildPaginationMeta,
  slugify,
  toOffset,
  type AuthContext,
  type PageQuery,
  type PaginationMeta,
} from '@/common/index.js';
import { AuditService } from '@/core/audit/audit.service.js';
import { AuthzRepository, AuthzService } from '@/core/authz/index.js';
import type { Tx } from '@/core/database/drizzle.module.js';
import type { Role } from '@/core/database/schema/index.js';
import { TransactionManager } from '@/core/database/transaction.manager.js';
import {
  ForbiddenActionError,
  InvalidInputError,
  ResourceConflictError,
  ResourceNotFoundError,
} from '@/core/errors/index.js';

import type { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from './dto/index.js';
import { RolesRepository } from './roles.repository.js';
import type { PermissionOption, RoleResponse } from './roles.types.js';

@Injectable()
export class RolesService {
  constructor(
    @Inject(TransactionManager) private readonly transactions: TransactionManager,
    @Inject(RolesRepository) private readonly repository: RolesRepository,
    @Inject(AuthzRepository) private readonly authzRepository: AuthzRepository,
    @Inject(AuthzService) private readonly authz: AuthzService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(query: PageQuery): Promise<{ items: RoleResponse[]; meta: PaginationMeta }> {
    const [rows, total] = await this.transactions.runInRequestContext(async (tx) =>
      Promise.all([
        this.repository.list(tx, {
          limit: query.limit,
          offset: toOffset(query.page, query.limit),
        }),
        this.repository.count(tx),
      ]),
    );
    const items = await this.withGrants(rows);

    return { items, meta: buildPaginationMeta(query, total) };
  }

  async findOrThrow(id: string): Promise<RoleResponse> {
    const role = await this.loadOrThrow(id);
    this.assertCan('read', role);

    return await this.withGrantsOne(role);
  }

  /** What the caller may put into a role: the catalog narrowed to what it already holds. */
  grantable(): PermissionOption[] {
    const held = this.authz.currentProfile()?.grants ?? [];

    return PERMISSION_CATALOG.filter((entry) => !entry.platformOnly).flatMap((entry) => {
      const presets = entry.presets.filter((preset) =>
        grantsCover(held, { action: entry.action, subject: entry.subject, preset }),
      );
      return presets.length === 0
        ? []
        : [
            {
              action: entry.action,
              subject: entry.subject,
              description: entry.description,
              presets,
            },
          ];
    });
  }

  async create(actor: AuthContext, dto: CreateRoleDto): Promise<RoleResponse> {
    const tenantId = this.resolveTenantId(actor, dto.tenantId);
    if (
      !this.authz.current().can('create', subject('Role', { id: 'new', tenantId, isSystem: false }))
    ) {
      throw new ForbiddenActionError('create', 'Role');
    }
    const grants = this.validateGrants(dto.permissions);

    const created = await this.transactions.runInRequestContext(async (tx) => {
      const role = await this.repository.create(tx, {
        tenantId,
        key: roleKey(dto.name),
        name: dto.name,
        scope: 'tenant',
        isSystem: false,
      });
      await this.writeGrants(tx, role.id, grants);
      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId,
        action: 'role.create',
        resourceType: 'Role',
        resourceId: role.id,
        afterState: { name: role.name, permissions: grants },
      });
      return role;
    });

    return { ...toRoleResponse(created), permissions: grants };
  }

  async rename(actor: AuthContext, id: string, dto: UpdateRoleDto): Promise<RoleResponse> {
    const existing = await this.loadOrThrow(id);
    this.assertCan('update', existing);

    const updated = await this.transactions.runInRequestContext(async (tx) => {
      const role = await this.repository.rename(tx, id, dto.name);
      if (role === undefined) return undefined;
      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId: role.tenantId,
        action: 'role.update',
        resourceType: 'Role',
        resourceId: id,
        beforeState: { name: existing.name },
        afterState: { name: role.name },
      });
      return role;
    });
    if (updated === undefined) throw new ResourceNotFoundError('Role', id);

    return await this.withGrantsOne(updated);
  }

  /** Replaces the whole permission set; the caller cannot grant more than it holds. */
  async setPermissions(
    actor: AuthContext,
    id: string,
    dto: SetRolePermissionsDto,
  ): Promise<RoleResponse> {
    const existing = await this.loadOrThrow(id);
    this.assertCan('update', existing);
    const grants = this.validateGrants(dto.permissions);

    const before = await this.withGrantsOne(existing);
    await this.transactions.runInRequestContext(async (tx) => {
      await this.writeGrants(tx, id, grants);
      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: 'role.permissions.update',
        resourceType: 'Role',
        resourceId: id,
        beforeState: { permissions: before.permissions },
        afterState: { permissions: grants },
      });
    });

    // Everyone holding the role gets the new permissions on their next request.
    await this.authz.invalidateRole(id);
    return { ...before, permissions: grants };
  }

  async remove(actor: AuthContext, id: string): Promise<void> {
    const existing = await this.loadOrThrow(id);
    this.assertCan('delete', existing);

    await this.transactions.runInRequestContext(async (tx) => {
      if ((await this.repository.countAssignments(tx, id)) > 0) {
        throw new ResourceConflictError('The role is still assigned to users');
      }
      await this.repository.softDelete(tx, id);
      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: 'role.delete',
        resourceType: 'Role',
        resourceId: id,
        beforeState: { name: existing.name },
      });
    });
  }

  /** A platform actor names the tenant; a tenant actor is pinned to its own. */
  private resolveTenantId(actor: AuthContext, requested: string | undefined): string {
    if (actor.scope === 'platform') {
      if (requested === undefined) throw new InvalidInputError('tenantId is required');
      return requested;
    }
    if (actor.tenantId === undefined) throw new ForbiddenActionError('create', 'Role');
    if (requested !== undefined && requested !== actor.tenantId) {
      throw new ForbiddenActionError('create', 'Role');
    }
    return actor.tenantId;
  }

  /**
   * Every grant must exist in the catalog, be allowed for a tenant role, use a
   * reach the catalog permits, and be covered by what the caller itself holds.
   */
  private validateGrants(requested: readonly PermissionGrant[]): PermissionGrant[] {
    const held = this.authz.currentProfile()?.grants ?? [];
    const seen = new Set<string>();

    return requested.map((grant) => {
      const key = permissionKey(grant.action, grant.subject);
      if (seen.has(key)) throw new InvalidInputError(`Duplicate permission ${key}`);
      seen.add(key);

      const entry = findCatalogEntry(grant.action, grant.subject);
      if (entry === undefined) throw new InvalidInputError(`Unknown permission ${key}`);
      if (entry.platformOnly) throw new InvalidInputError(`${key} is reserved for the platform`);
      if (!entry.presets.includes(grant.preset)) {
        throw new InvalidInputError(`${key} cannot use the "${grant.preset}" reach`);
      }
      if (!grantsCover(held, grant)) throw new ForbiddenActionError('grant', key);

      return grant;
    });
  }

  private async writeGrants(
    tx: Tx,
    roleId: string,
    grants: readonly PermissionGrant[],
  ): Promise<void> {
    const ids = await this.repository.permissionIds(
      tx,
      grants.map((g) => permissionKey(g.action, g.subject)),
    );

    await this.repository.replaceGrants(
      tx,
      roleId,
      grants.map((grant) => {
        const permissionId = ids.get(permissionKey(grant.action, grant.subject));
        if (permissionId === undefined) {
          throw new InvalidInputError(`Unknown permission ${grant.action}:${grant.subject}`);
        }
        return { permissionId, scopePreset: grant.preset };
      }),
    );
  }

  private async withGrantsOne(row: Role): Promise<RoleResponse> {
    const [first] = await this.withGrants([row]);
    if (first === undefined) throw new ResourceNotFoundError('Role', row.id);
    return first;
  }

  private async withGrants(rows: readonly Role[]): Promise<RoleResponse[]> {
    const loaded = await this.transactions.runInRequestContext(async (tx) =>
      this.authzRepository.loadRolesWithGrants(
        tx,
        rows.map((r) => r.id),
      ),
    );
    const byId = new Map(loaded.map((role) => [role.id, role.grants]));

    return rows.map((row) => ({ ...toRoleResponse(row), permissions: byId.get(row.id) ?? [] }));
  }

  /** RLS shows system roles and the caller's own, so a foreign id reads as missing. */
  private async loadOrThrow(id: string): Promise<Role> {
    const role = await this.transactions.runInRequestContext(async (tx) =>
      this.repository.findById(tx, id),
    );
    if (role === undefined) throw new ResourceNotFoundError('Role', id);

    return role;
  }

  /** Layer 2: `isSystem` and `tenantId` feed the CASL conditions (system roles are immutable). */
  private assertCan(action: Action, role: Role): void {
    const entity = subject('Role', {
      id: role.id,
      tenantId: role.tenantId,
      isSystem: role.isSystem,
    });
    if (!this.authz.current().can(action, entity)) throw new ForbiddenActionError(action, 'Role');
  }
}

function roleKey(name: string): string {
  const base = slugify(name).replaceAll('-', '_').toUpperCase();
  return base === '' ? 'ROLE' : base;
}

function toRoleResponse(role: Role): Omit<RoleResponse, 'permissions'> {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    scope: role.scope === 'platform' ? 'platform' : 'tenant',
    isSystem: role.isSystem,
    tenantId: role.tenantId,
  };
}
