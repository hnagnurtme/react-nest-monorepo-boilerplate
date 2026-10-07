import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { AuthContext } from '@/common/index.js';
import type { User } from '@/core/database/schema/index.js';
import type { TransactionManager } from '@/core/database/transaction.manager.js';
import { ForbiddenActionError, ResourceNotFoundError } from '@/core/errors/index.js';
import { UsersService } from '@/modules/users/users.service.js';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function makeUser(overrides: Partial<User>): User {
  return {
    id: 'u-1',
    email: 'u1@example.com',
    passwordHash: 'x',
    fullName: 'User One',
    phoneNumber: null,
    role: 'TENANT_MEMBER',
    tenantId: 't-1',
    isActive: true,
    isEmailVerified: true,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

function makeActor(overrides: Partial<AuthContext>): AuthContext {
  return {
    id: 'actor',
    email: 'actor@example.com',
    role: 'TENANT_ADMIN',
    tenantId: 't-1',
    jti: 'jti',
    ...overrides,
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let repository: { findById: Mock; update: Mock; softDelete: Mock; list: Mock; count: Mock };

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      list: vi.fn(),
      count: vi.fn(),
    };
    const transactions = {
      runInRequestContext: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    };

    service = new UsersService(transactions as unknown as TransactionManager, repository);
  });

  it('throws not found when the row is invisible (other tenant or missing)', async () => {
    repository.findById.mockResolvedValue(undefined);

    await expect(service.findOrThrow(makeActor({}), 'u-9')).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
  });

  it('refuses a read the ability denies even if RLS let the row through', async () => {
    repository.findById.mockResolvedValue(makeUser({ id: 'u-2', tenantId: 't-2' }));

    await expect(service.findOrThrow(makeActor({}), 'u-2')).rejects.toBeInstanceOf(
      ForbiddenActionError,
    );
  });

  it('lets a member update itself but not change isActive', async () => {
    const member = makeActor({ id: 'u-1', role: 'TENANT_MEMBER' });
    repository.findById.mockResolvedValue(makeUser({ id: 'u-1' }));
    repository.update.mockResolvedValue(makeUser({ id: 'u-1', fullName: 'Renamed' }));

    await expect(service.update(member, 'u-1', { fullName: 'Renamed' })).resolves.toMatchObject({
      fullName: 'Renamed',
    });
    await expect(service.update(member, 'u-1', { isActive: false })).rejects.toBeInstanceOf(
      ForbiddenActionError,
    );
  });

  it('does not let an admin delete its own account', async () => {
    repository.findById.mockResolvedValue(makeUser({ id: 'actor' }));

    await expect(service.remove(makeActor({}), 'actor')).rejects.toBeInstanceOf(
      ForbiddenActionError,
    );
    expect(repository.softDelete).not.toHaveBeenCalled();
  });

  it('lets an admin soft-delete a tenant member', async () => {
    repository.findById.mockResolvedValue(makeUser({ id: 'u-2' }));
    repository.softDelete.mockResolvedValue(true);

    await service.remove(makeActor({}), 'u-2');

    expect(repository.softDelete).toHaveBeenCalledWith(expect.anything(), 'u-2');
  });

  it('paginates and never exposes the password hash', async () => {
    repository.list.mockResolvedValue([makeUser({})]);
    repository.count.mockResolvedValue(1);

    const result = await service.list({ page: 1, limit: 20, sortOrder: 'desc' });

    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(result.items[0]).not.toHaveProperty('passwordHash');
  });
});
