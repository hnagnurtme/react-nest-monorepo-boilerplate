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
import type { User } from '@/core/database/schema/index.js';
import { TransactionManager } from '@/core/database/transaction.manager.js';
import { ForbiddenActionError, ResourceNotFoundError } from '@/core/errors/index.js';

import type { UpdateUserDto } from './dto/index.js';
import { USER_SORT_FIELDS, UsersRepository, type UserPatch } from './users.repository.js';
import type { UserResponse } from './users.types.js';

@Injectable()
export class UsersService {
  constructor(
    @Inject(TransactionManager) private readonly transactions: TransactionManager,
    @Inject(UsersRepository) private readonly repository: UsersRepository,
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

    const updated = await this.transactions.runInRequestContext(async (tx) =>
      this.repository.update(tx, id, toPatch(dto)),
    );
    if (updated === undefined) throw new ResourceNotFoundError('User', id);

    return toUserResponse(updated);
  }

  async remove(actor: AuthContext, id: string): Promise<void> {
    const existing = await this.loadOrThrow(id);
    this.assertCan(actor, 'delete', existing);
    if (existing.id === actor.id) throw new ForbiddenActionError('delete', 'own account');

    await this.transactions.runInRequestContext(async (tx) => this.repository.softDelete(tx, id));
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
