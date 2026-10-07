import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { SYSTEM_ROLES, buildAbility, type PermissionGrant } from '@repo/shared-types';

import type { AuthContext } from '@/common/index.js';
import type { Tenant } from '@/core/database/schema/index.js';
import { ForbiddenActionError, ResourceNotFoundError } from '@/core/errors/index.js';
import { TenantsService } from '@/modules/tenants/tenants.service.js';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 't-1',
    name: 'Acme',
    slug: 'acme',
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

const TENANT_ADMIN: AuthContext = {
  id: 'actor',
  email: 'a@x.test',
  tenantId: 't-1',
  scope: 'tenant',
  roles: ['TENANT_ADMIN'],
  jti: 'j',
};
const PLATFORM_ADMIN: AuthContext = {
  id: 'root',
  email: 'r@x.test',
  scope: 'platform',
  roles: ['PLATFORM_ADMIN'],
  jti: 'j',
};

describe('TenantsService', () => {
  let service: TenantsService;
  let repository: Record<'findById' | 'create' | 'update' | 'list' | 'count', Mock>;
  let audit: { record: Mock };
  let authz: { current: Mock };

  const as = (actor: AuthContext, grants: readonly PermissionGrant[]): AuthContext => {
    authz.current.mockReturnValue(buildAbility(grants, { id: actor.id, tenantId: actor.tenantId }));
    return actor;
  };

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      create: vi.fn((_tx: unknown, values: Partial<Tenant>) =>
        Promise.resolve(makeTenant({ id: 'new-id', ...values })),
      ),
      update: vi.fn(),
      list: vi.fn(),
      count: vi.fn(),
    };
    audit = { record: vi.fn() };
    authz = { current: vi.fn() };
    const transactions = {
      runInRequestContext: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
    };

    service = new TenantsService(transactions as never, repository as never, audit, authz as never);
  });

  it('lets only a platform admin create a tenant, and audits it', async () => {
    const tenantAdmin = as(TENANT_ADMIN, SYSTEM_ROLES.TENANT_ADMIN.grants);
    await expect(service.create(tenantAdmin, { name: 'X', slug: 'x' })).rejects.toBeInstanceOf(
      ForbiddenActionError,
    );

    const root = as(PLATFORM_ADMIN, SYSTEM_ROLES.PLATFORM_ADMIN.grants);
    await service.create(root, { name: 'Globex', slug: 'globex' });

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'tenant.create', resourceId: 'new-id' }),
    );
  });

  it('lets a tenant admin rename its own tenant but not switch it off', async () => {
    const admin = as(TENANT_ADMIN, SYSTEM_ROLES.TENANT_ADMIN.grants);
    repository.findById.mockResolvedValue(makeTenant());
    repository.update.mockResolvedValue(makeTenant({ name: 'Renamed' }));

    await expect(service.update(admin, 't-1', { name: 'Renamed' })).resolves.toMatchObject({
      name: 'Renamed',
    });
    await expect(service.update(admin, 't-1', { isActive: false })).rejects.toBeInstanceOf(
      ForbiddenActionError,
    );
  });

  it('refuses a read of another tenant even if RLS let the row through', async () => {
    as(TENANT_ADMIN, SYSTEM_ROLES.TENANT_ADMIN.grants);
    repository.findById.mockResolvedValue(makeTenant({ id: 't-2' }));

    await expect(service.findOrThrow('t-2')).rejects.toBeInstanceOf(ForbiddenActionError);
  });

  it('throws not found for an invisible tenant', async () => {
    as(TENANT_ADMIN, SYSTEM_ROLES.TENANT_ADMIN.grants);
    repository.findById.mockResolvedValue(undefined);

    await expect(service.findOrThrow('t-9')).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
