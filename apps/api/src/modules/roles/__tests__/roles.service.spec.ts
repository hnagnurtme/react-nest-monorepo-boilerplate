import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { SYSTEM_ROLES, buildAbility, type PermissionGrant } from '@repo/shared-types';

import type { AuthContext } from '@/common/index.js';
import type { Role } from '@/core/database/schema/index.js';
import {
  ForbiddenActionError,
  InvalidInputError,
  ResourceConflictError,
  ResourceNotFoundError,
} from '@/core/errors/index.js';
import { RolesService } from '@/modules/roles/roles.service.js';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const TENANT = '11111111-1111-4111-8111-111111111111';

function makeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: 'r-1',
    tenantId: TENANT,
    key: 'SUPPORT',
    name: 'Support',
    scope: 'tenant',
    isSystem: false,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

const ADMIN: AuthContext = {
  id: 'actor',
  email: 'a@x.test',
  tenantId: TENANT,
  scope: 'tenant',
  roles: ['TENANT_ADMIN'],
  jti: 'j',
};
const ROOT: AuthContext = {
  id: 'root',
  email: 'r@x.test',
  scope: 'platform',
  roles: ['PLATFORM_ADMIN'],
  jti: 'j',
};

describe('RolesService', () => {
  let service: RolesService;
  let repository: Record<
    | 'findById'
    | 'create'
    | 'rename'
    | 'softDelete'
    | 'countAssignments'
    | 'permissionIds'
    | 'replaceGrants'
    | 'list'
    | 'count',
    Mock
  >;
  let authzRepository: { loadRolesWithGrants: Mock };
  let authz: { current: Mock; currentProfile: Mock; invalidateRole: Mock };
  let audit: { record: Mock };

  const as = (actor: AuthContext, grants: readonly PermissionGrant[]): AuthContext => {
    authz.current.mockReturnValue(buildAbility(grants, { id: actor.id, tenantId: actor.tenantId }));
    authz.currentProfile.mockReturnValue({ grants });
    return actor;
  };
  const admin = (): AuthContext => as(ADMIN, SYSTEM_ROLES.TENANT_ADMIN.grants);

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      create: vi.fn((_tx: unknown, values: Partial<Role>) =>
        Promise.resolve(makeRole({ id: 'new-id', ...values })),
      ),
      rename: vi.fn(),
      softDelete: vi.fn(),
      countAssignments: vi.fn(() => Promise.resolve(0)),
      permissionIds: vi.fn((_tx: unknown, keys: string[]) =>
        Promise.resolve(new Map(keys.map((key) => [key, `perm-${key}`]))),
      ),
      replaceGrants: vi.fn(),
      list: vi.fn(),
      count: vi.fn(),
    };
    authzRepository = { loadRolesWithGrants: vi.fn(() => Promise.resolve([])) };
    authz = { current: vi.fn(), currentProfile: vi.fn(), invalidateRole: vi.fn() };
    audit = { record: vi.fn() };
    const transactions = {
      runInRequestContext: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
    };

    service = new RolesService(
      transactions as never,
      repository as never,
      authzRepository as never,
      authz as never,
      audit,
    );
  });

  const grant = (
    action: PermissionGrant['action'],
    subject: string,
    preset: PermissionGrant['preset'] = 'own_tenant',
  ): PermissionGrant => ({ action, subject, preset });

  describe('create', () => {
    it('creates a custom tenant role with the validated grants and audits it', async () => {
      const actor = admin();

      const role = await service.create(actor, {
        name: 'Support Agent',
        permissions: [grant('read', 'User')],
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tenantId: TENANT,
          key: 'SUPPORT_AGENT',
          scope: 'tenant',
          isSystem: false,
        }),
      );
      expect(repository.replaceGrants).toHaveBeenCalledWith(expect.anything(), 'new-id', [
        { permissionId: 'perm-read:User', scopePreset: 'own_tenant' },
      ]);
      expect(role.permissions).toEqual([grant('read', 'User')]);
      expect(audit.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'role.create' }),
      );
    });

    it('refuses to grant more than the caller holds', async () => {
      const actor = as(ADMIN, [grant('create', 'Role'), grant('read', 'User')]);

      await expect(
        service.create(actor, { name: 'Escalate', permissions: [grant('delete', 'User')] }),
      ).rejects.toBeInstanceOf(ForbiddenActionError);
      await expect(
        service.create(actor, {
          name: 'Wider',
          permissions: [grant('read', 'User', 'own_record')],
        }),
      ).resolves.toBeDefined();
      expect(repository.create).toHaveBeenCalledTimes(1);
    });

    it('rejects platform-only, unknown, duplicate and out-of-range grants', async () => {
      const actor = admin();
      const create = async (permissions: PermissionGrant[]) =>
        service.create(actor, { name: 'Bad', permissions });

      await expect(create([grant('create', 'Tenant')])).rejects.toBeInstanceOf(InvalidInputError);
      await expect(create([grant('read', 'Nope')])).rejects.toBeInstanceOf(InvalidInputError);
      await expect(create([grant('read', 'User'), grant('read', 'User')])).rejects.toBeInstanceOf(
        InvalidInputError,
      );
      await expect(create([grant('read', 'User', 'any')])).rejects.toBeInstanceOf(
        InvalidInputError,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('pins a tenant admin to its own tenant; a platform admin must name one', async () => {
      await expect(
        service.create(admin(), {
          name: 'X',
          tenantId: '22222222-2222-4222-8222-222222222222',
          permissions: [],
        }),
      ).rejects.toBeInstanceOf(ForbiddenActionError);

      const root = as(ROOT, SYSTEM_ROLES.PLATFORM_ADMIN.grants);
      await expect(service.create(root, { name: 'X', permissions: [] })).rejects.toBeInstanceOf(
        InvalidInputError,
      );
      await service.create(root, { name: 'X', tenantId: TENANT, permissions: [] });
      expect(repository.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ tenantId: TENANT }),
      );
    });

    it('refuses a member', async () => {
      const member = as({ ...ADMIN, roles: ['TENANT_MEMBER'] }, SYSTEM_ROLES.TENANT_MEMBER.grants);

      await expect(service.create(member, { name: 'X', permissions: [] })).rejects.toBeInstanceOf(
        ForbiddenActionError,
      );
    });
  });

  describe('system roles are immutable', () => {
    const system = makeRole({ id: 'sys', tenantId: null, isSystem: true, key: 'TENANT_ADMIN' });

    it('cannot be renamed, re-granted or deleted, even by a platform admin', async () => {
      const root = as(ROOT, SYSTEM_ROLES.PLATFORM_ADMIN.grants);
      repository.findById.mockResolvedValue(system);

      await expect(service.rename(root, 'sys', { name: 'Hacked' })).rejects.toBeInstanceOf(
        ForbiddenActionError,
      );
      await expect(service.setPermissions(root, 'sys', { permissions: [] })).rejects.toBeInstanceOf(
        ForbiddenActionError,
      );
      await expect(service.remove(root, 'sys')).rejects.toBeInstanceOf(ForbiddenActionError);
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('can still be read by a tenant admin', async () => {
      admin();
      repository.findById.mockResolvedValue(system);

      await expect(service.findOrThrow('sys')).resolves.toMatchObject({ isSystem: true });
    });
  });

  describe('custom role changes', () => {
    it('replaces permissions and evicts the profiles of everyone holding the role', async () => {
      const actor = admin();
      repository.findById.mockResolvedValue(makeRole());

      await service.setPermissions(actor, 'r-1', { permissions: [grant('read', 'User')] });

      expect(repository.replaceGrants).toHaveBeenCalled();
      expect(authz.invalidateRole).toHaveBeenCalledWith('r-1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'role.permissions.update' }),
      );
    });

    it('cannot touch a role of another tenant', async () => {
      const actor = admin();
      repository.findById.mockResolvedValue(
        makeRole({ tenantId: '22222222-2222-4222-8222-222222222222' }),
      );

      await expect(service.rename(actor, 'r-1', { name: 'X' })).rejects.toBeInstanceOf(
        ForbiddenActionError,
      );
    });

    it('refuses to delete a role that is still assigned', async () => {
      const actor = admin();
      repository.findById.mockResolvedValue(makeRole());
      repository.countAssignments.mockResolvedValue(2);

      await expect(service.remove(actor, 'r-1')).rejects.toBeInstanceOf(ResourceConflictError);
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('deletes an unassigned role', async () => {
      const actor = admin();
      repository.findById.mockResolvedValue(makeRole());

      await service.remove(actor, 'r-1');

      expect(repository.softDelete).toHaveBeenCalledWith(expect.anything(), 'r-1');
    });

    it('reports a missing role as not found', async () => {
      admin();
      repository.findById.mockResolvedValue(undefined);

      await expect(service.findOrThrow('nope')).rejects.toBeInstanceOf(ResourceNotFoundError);
    });
  });

  describe('grantable', () => {
    it('offers only what the caller holds, never platform-only entries', () => {
      authz.currentProfile.mockReturnValue({ grants: SYSTEM_ROLES.TENANT_MEMBER.grants });

      const options = service.grantable();
      const keys = options.map((o) => `${o.action}:${o.subject}`);

      expect(keys).toContain('read:User');
      expect(keys).not.toContain('create:User');
      expect(keys).not.toContain('create:Tenant');
      expect(options.find((o) => o.subject === 'User' && o.action === 'update')?.presets).toEqual([
        'own_record',
      ]);
    });
  });
});
