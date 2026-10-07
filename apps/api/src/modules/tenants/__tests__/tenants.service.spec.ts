import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { AuthContext } from '@/common/index.js';
import type { Tenant } from '@/core/database/schema/index.js';
import type { TransactionManager } from '@/core/database/transaction.manager.js';
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

describe('TenantsService', () => {
  let service: TenantsService;
  let repository: { findById: Mock; create: Mock; update: Mock; list: Mock; count: Mock };
  let audit: { record: Mock };

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
    const transactions = {
      runInRequestContext: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    };

    service = new TenantsService(transactions as unknown as TransactionManager, repository, audit);
  });

  it('lets only a platform admin create a tenant, and audits it', async () => {
    const platformAdmin = makeActor({ role: 'PLATFORM_ADMIN', tenantId: undefined });

    await expect(service.create(makeActor({}), { name: 'X', slug: 'x' })).rejects.toBeInstanceOf(
      ForbiddenActionError,
    );
    await service.create(platformAdmin, { name: 'Globex', slug: 'globex' });

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'tenant.create', resourceId: 'new-id' }),
    );
  });

  it('lets a tenant admin rename its own tenant but not switch it off', async () => {
    repository.findById.mockResolvedValue(makeTenant());
    repository.update.mockResolvedValue(makeTenant({ name: 'Renamed' }));

    await expect(service.update(makeActor({}), 't-1', { name: 'Renamed' })).resolves.toMatchObject({
      name: 'Renamed',
    });
    await expect(service.update(makeActor({}), 't-1', { isActive: false })).rejects.toBeInstanceOf(
      ForbiddenActionError,
    );
  });

  it('refuses a read of another tenant even if RLS let the row through', async () => {
    repository.findById.mockResolvedValue(makeTenant({ id: 't-2' }));

    await expect(service.findOrThrow(makeActor({}), 't-2')).rejects.toBeInstanceOf(
      ForbiddenActionError,
    );
  });

  it('throws not found for an invisible tenant', async () => {
    repository.findById.mockResolvedValue(undefined);

    await expect(service.findOrThrow(makeActor({}), 't-9')).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
  });
});
