import { subject } from '@casl/ability';
import { Inject, Injectable } from '@nestjs/common';

import { defineAbilityFor, type Action, type AppAbility, type UserRole } from '@repo/shared-types';

import {
  buildPaginationMeta,
  parseSort,
  toOffset,
  type AuthContext,
  type PageQuery,
  type PaginationMeta,
} from '@/common/index.js';
import { AuditService } from '@/core/audit/audit.service.js';
import type { User } from '@/core/database/schema/index.js';
import { TransactionManager } from '@/core/database/transaction.manager.js';
import { ForbiddenActionError, ResourceNotFoundError } from '@/core/errors/index.js';
import { CredentialsService } from '@/modules/auth/index.js';

import type { CreateUserDto, UpdateUserDto } from './dto/index.js';
import { USER_SORT_FIELDS, UsersRepository, type UserPatch } from './users.repository.js';
import type { UserResponse } from './users.types.js';

@Injectable()
export class UsersService {
  constructor(
    @Inject(TransactionManager) private readonly transactions: TransactionManager,
    @Inject(UsersRepository) private readonly repository: UsersRepository,
    @Inject(CredentialsService) private readonly credentials: CredentialsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(query: PageQuery): Promise<{ items: UserResponse[]; meta: PaginationMeta }> {
    const sort = parseSort(query, USER_SORT_FIELDS);

    const [rows, total] = await this.transactions.runInRequestContext(async (tx) =>
      Promise.all([
        this.repository.list(
          tx,
          { limit: query.limit, offset: toOffset(query.page, query.limit) },
          sort,
        ),
        this.repository.count(tx),
      ]),
    );

    return { items: rows.map(toUserResponse), meta: buildPaginationMeta(query, total) };
  }

  /**
   * Accounts are created by admins only; there is no self sign-up. The account
   * is born active and verified, with the password the admin chose.
   */
  async create(actor: AuthContext, dto: CreateUserDto): Promise<UserResponse> {
    const tenantId = this.resolveTenantId(actor, dto);

    const ability: AppAbility = defineAbilityFor(actor);
    const target = subject('User', { id: 'new', ...(tenantId === null ? {} : { tenantId }) });
    if (!ability.can('create', target)) throw new ForbiddenActionError('create', 'User');

    const passwordHash = await this.credentials.hash(dto.password);

    const created = await this.transactions.runInRequestContext(async (tx) => {
      const row = await this.repository.create(tx, {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber ?? null,
        role: dto.role,
        tenantId,
        isActive: true,
        isEmailVerified: true,
      });
      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId,
        action: 'user.create',
        resourceType: 'User',
        resourceId: row.id,
        afterState: toUserResponse(row),
      });
      return row;
    });

    return toUserResponse(created);
  }

  async findOrThrow(actor: AuthContext, id: string): Promise<UserResponse> {
    const user = await this.loadOrThrow(id);
    this.assertCan(actor, 'read', user);

    return toUserResponse(user);
  }

  async update(actor: AuthContext, id: string, dto: UpdateUserDto): Promise<UserResponse> {
    const existing = await this.loadOrThrow(id);
    this.assertCan(actor, 'update', existing);
    // Activating or deactivating an account is an admin decision, not a
    // profile edit: it needs the `delete` ability, which a member lacks even on
    // its own record.
    if (dto.isActive !== undefined) this.assertCan(actor, 'delete', existing);

    const updated = await this.transactions.runInRequestContext(async (tx) => {
      const row = await this.repository.update(tx, id, toPatch(dto));
      if (row === undefined) return undefined;
      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId: row.tenantId,
        action: 'user.update',
        resourceType: 'User',
        resourceId: id,
        beforeState: toUserResponse(existing),
        afterState: toUserResponse(row),
      });
      return row;
    });
    if (updated === undefined) throw new ResourceNotFoundError('User', id);

    return toUserResponse(updated);
  }

  async remove(actor: AuthContext, id: string): Promise<void> {
    const existing = await this.loadOrThrow(id);
    this.assertCan(actor, 'delete', existing);
    if (existing.id === actor.id) throw new ForbiddenActionError('delete', 'own account');

    await this.transactions.runInRequestContext(async (tx) => {
      await this.repository.softDelete(tx, id);
      await this.audit.record(tx, {
        actorId: actor.id,
        tenantId: existing.tenantId,
        action: 'user.delete',
        resourceType: 'User',
        resourceId: id,
        beforeState: toUserResponse(existing),
      });
    });
  }

  /**
   * A tenant admin always creates inside its own tenant; a platform admin picks
   * the tenant, and a platform-admin account has none.
   */
  private resolveTenantId(actor: AuthContext, dto: CreateUserDto): string | null {
    if (actor.role === 'PLATFORM_ADMIN') {
      if (dto.role === 'PLATFORM_ADMIN') {
        if (dto.tenantId !== undefined) throw new ForbiddenActionError('create', 'User');
        return null;
      }
      if (dto.tenantId === undefined) throw new ForbiddenActionError('create', 'User');
      return dto.tenantId;
    }

    if (dto.role === 'PLATFORM_ADMIN') throw new ForbiddenActionError('create', 'User');
    if (actor.tenantId === undefined) throw new ForbiddenActionError('create', 'User');
    if (dto.tenantId !== undefined && dto.tenantId !== actor.tenantId) {
      throw new ForbiddenActionError('create', 'User');
    }
    return actor.tenantId;
  }

  /** RLS hides other tenants' rows, so a foreign id is indistinguishable from a missing one. */
  private async loadOrThrow(id: string): Promise<User> {
    const user = await this.transactions.runInRequestContext(async (tx) =>
      this.repository.findById(tx, id),
    );
    if (user === undefined) throw new ResourceNotFoundError('User', id);

    return user;
  }

  /** Layer 2: a bare `'User'` string would ignore every condition (see CheckPolicies). */
  private assertCan(actor: AuthContext, action: Action, user: User): void {
    const ability: AppAbility = defineAbilityFor(actor);
    const target = subject('User', { id: user.id, ...tenantOf(user) });

    if (!ability.can(action, target)) throw new ForbiddenActionError(action, 'User');
  }
}

function tenantOf(user: User): { tenantId?: string } {
  return user.tenantId === null ? {} : { tenantId: user.tenantId };
}

function toPatch(dto: UpdateUserDto): UserPatch {
  return {
    ...(dto.fullName === undefined ? {} : { fullName: dto.fullName }),
    ...(dto.phoneNumber === undefined ? {} : { phoneNumber: dto.phoneNumber }),
    ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
  };
}

function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phoneNumber: user.phoneNumber,
    role: user.role as UserRole,
    tenantId: user.tenantId,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}
