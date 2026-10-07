import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { AuthContext } from '@/common/index.js';
import type { User } from '@/core/database/schema/index.js';
import type { TransactionManager } from '@/core/database/transaction.manager.js';
import { ForbiddenActionError, ResourceNotFoundError } from '@/core/errors/index.js';
import type { CredentialsService } from '@/modules/auth/index.js';
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
  let repository: {
    findById: Mock;
    update: Mock;
    softDelete: Mock;
    list: Mock;
    count: Mock;
    create: Mock;
  };
  let audit: { record: Mock };

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      list: vi.fn(),
      count: vi.fn(),
      create: vi.fn((_tx: unknown, values: Partial<User>) =>
        Promise.resolve(makeUser({ id: 'new-id', ...values })),
      ),
    };
    audit = { record: vi.fn() };
    const transactions = {
      runInRequestContext: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    };

    const credentials = { hash: vi.fn(() => Promise.resolve('hashed')) };

    service = new UsersService(
      transactions as unknown as TransactionManager,
      repository,
      credentials as unknown as CredentialsService,
      audit,
    );
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

  describe('create', () => {
    const base = {
      email: 'new@example.com',
      fullName: 'New User',
      password: 'Password123!',
      role: 'TENANT_MEMBER',
    } as const;

    it("puts a tenant admin's new user in the admin's own tenant, verified and active", async () => {
      const result = await service.create(makeActor({}), { ...base });

      expect(repository.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tenantId: 't-1',
          passwordHash: 'hashed',
          isActive: true,
          isEmailVerified: true,
        }),
      );
      expect(result).not.toHaveProperty('passwordHash');
      expect(audit.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'user.create', tenantId: 't-1' }),
      );
    });

    it('refuses a tenant admin creating in another tenant or a platform admin', async () => {
      await expect(
        service.create(makeActor({}), {
          ...base,
          tenantId: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toBeInstanceOf(ForbiddenActionError);
      await expect(
        service.create(makeActor({}), { ...base, role: 'PLATFORM_ADMIN' }),
      ).rejects.toBeInstanceOf(ForbiddenActionError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('refuses a member', async () => {
      await expect(
        service.create(makeActor({ role: 'TENANT_MEMBER' }), { ...base }),
      ).rejects.toBeInstanceOf(ForbiddenActionError);
    });

    it('lets a platform admin pick the tenant, and requires one for tenant roles', async () => {
      const admin = makeActor({ role: 'PLATFORM_ADMIN', tenantId: undefined });
      const tenantId = '22222222-2222-4222-8222-222222222222';

      await service.create(admin, { ...base, tenantId });
      expect(repository.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ tenantId }),
      );
      await expect(service.create(admin, { ...base })).rejects.toBeInstanceOf(ForbiddenActionError);
    });

    it('creates a tenant-less platform admin only for a platform admin', async () => {
      const admin = makeActor({ role: 'PLATFORM_ADMIN', tenantId: undefined });

      await service.create(admin, { ...base, role: 'PLATFORM_ADMIN' });
      expect(repository.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ tenantId: null, role: 'PLATFORM_ADMIN' }),
      );
    });
  });
});
