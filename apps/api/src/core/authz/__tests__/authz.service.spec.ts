import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { SYSTEM_ROLES } from '@repo/shared-types';

import { AuthzService } from '@/core/authz/authz.service.js';
import type { AuthzProfile } from '@/core/authz/authz.types.js';
import { CLS_KEYS } from '@/core/database/request-context.js';

const profileRows = {
  userId: 'u-1',
  email: 'a@x.test',
  tenantId: 't-1',
  roles: [
    {
      id: SYSTEM_ROLES.TENANT_ADMIN.id,
      key: 'TENANT_ADMIN',
      name: 'Admin',
      scope: 'tenant' as const,
    },
  ],
  grants: [...SYSTEM_ROLES.TENANT_ADMIN.grants],
};

describe('AuthzService', () => {
  let service: AuthzService;
  let repository: { loadProfileRows: Mock; userIdsWithRole: Mock };
  let redis: { get: Mock; setWithTtl: Mock; delete: Mock };
  let cls: { get: Mock };
  let transactions: { run: Mock };

  beforeEach(() => {
    repository = { loadProfileRows: vi.fn(), userIdsWithRole: vi.fn() };
    redis = {
      get: vi.fn(() => Promise.resolve(null)),
      setWithTtl: vi.fn(),
      delete: vi.fn(),
    };
    cls = { get: vi.fn() };
    transactions = { run: vi.fn((_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({})) };
    service = new AuthzService(
      transactions as never,
      repository as never,
      redis as never,
      cls as never,
    );
  });

  it('loads from the database in admin mode on a miss, derives scope, and caches', async () => {
    repository.loadProfileRows.mockResolvedValue(profileRows);

    const profile = await service.loadProfile('u-1');

    expect(transactions.run).toHaveBeenCalledWith(
      expect.objectContaining({ accessMode: 'admin' }),
      expect.any(Function),
    );
    expect(profile?.scope).toBe('tenant');
    expect(redis.setWithTtl).toHaveBeenCalledWith('authz:profile:u-1', expect.any(String), 300);
  });

  it('marks a user holding any platform-scope role as platform', async () => {
    repository.loadProfileRows.mockResolvedValue({
      ...profileRows,
      tenantId: null,
      roles: [
        { id: SYSTEM_ROLES.PLATFORM_ADMIN.id, key: 'PLATFORM_ADMIN', name: 'P', scope: 'platform' },
      ],
    });

    await expect(service.loadProfile('u-1')).resolves.toMatchObject({ scope: 'platform' });
  });

  it('serves a hit from the cache without touching the database', async () => {
    const cached: AuthzProfile = { ...profileRows, scope: 'tenant' };
    redis.get.mockResolvedValue(JSON.stringify(cached));

    await expect(service.loadProfile('u-1')).resolves.toEqual(cached);
    expect(repository.loadProfileRows).not.toHaveBeenCalled();
  });

  it('treats a corrupt cache entry as a miss', async () => {
    redis.get.mockResolvedValue('{not json');
    repository.loadProfileRows.mockResolvedValue(profileRows);

    await expect(service.loadProfile('u-1')).resolves.toBeDefined();
    expect(repository.loadProfileRows).toHaveBeenCalled();
  });

  it('returns undefined, and caches nothing, for an inactive or missing user', async () => {
    repository.loadProfileRows.mockResolvedValue(undefined);

    await expect(service.loadProfile('gone')).resolves.toBeUndefined();
    expect(redis.setWithTtl).not.toHaveBeenCalled();
  });

  it('builds the request ability from the profile the guard stored, anonymous otherwise', () => {
    expect(service.current().can('read', 'User')).toBe(false);

    cls.get.mockImplementation((key: string) =>
      key === CLS_KEYS.profile ? { ...profileRows, scope: 'tenant' } : undefined,
    );
    expect(service.current().can('read', 'User')).toBe(true);
    expect(service.current().can('create', 'Tenant')).toBe(false);
  });

  it('evicts users directly, or everyone holding a role', async () => {
    await service.invalidateUsers(['a', 'b']);
    expect(redis.delete).toHaveBeenCalledWith('authz:profile:a');
    expect(redis.delete).toHaveBeenCalledWith('authz:profile:b');

    repository.userIdsWithRole.mockResolvedValue(['c', 'd']);
    await service.invalidateRole('role-1');
    expect(redis.delete).toHaveBeenCalledWith('authz:profile:c');
    expect(redis.delete).toHaveBeenCalledWith('authz:profile:d');
  });
});
