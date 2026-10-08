import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { SYSTEM_ROLES, buildAbility, type PermissionGrant } from '@repo/shared-types';

import type { AuthContext } from '@/common/index.js';
import type { AppConfig } from '@/config/index.js';
import type { RoleWithGrants } from '@/core/authz/index.js';
import type { User } from '@/core/database/schema/index.js';
import {
  ForbiddenActionError,
  ResourceConflictError,
  ResourceNotFoundError,
} from '@/core/errors/index.js';
import { UsersService } from '@/modules/users/users.service.js';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u-1',
    email: 'u1@example.com',
    passwordHash: 'x',
    fullName: 'User One',
    phoneNumber: null,
    tenantId: TENANT,
    isActive: true,
    isEmailVerified: true,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

const ROLE_ADMIN: RoleWithGrants = {
  id: SYSTEM_ROLES.TENANT_ADMIN.id,
  key: 'TENANT_ADMIN',
  name: 'Tenant administrator',
  scope: 'tenant',
  tenantId: null,
  isSystem: true,
  grants: [...SYSTEM_ROLES.TENANT_ADMIN.grants],
};
const ROLE_MEMBER: RoleWithGrants = {
  id: SYSTEM_ROLES.TENANT_MEMBER.id,
  key: 'TENANT_MEMBER',
  name: 'Tenant member',
  scope: 'tenant',
  tenantId: null,
  isSystem: true,
  grants: [...SYSTEM_ROLES.TENANT_MEMBER.grants],
};
const ROLE_PLATFORM: RoleWithGrants = {
  id: SYSTEM_ROLES.PLATFORM_ADMIN.id,
  key: 'PLATFORM_ADMIN',
  name: 'Platform administrator',
  scope: 'platform',
  tenantId: null,
  isSystem: true,
  grants: [...SYSTEM_ROLES.PLATFORM_ADMIN.grants],
};

interface Actor {
  auth: AuthContext;
  grants: PermissionGrant[];
}

function tenantAdmin(id = 'actor'): Actor {
  return {
    auth: {
      id,
      email: 'a@x.test',
      tenantId: TENANT,
      scope: 'tenant',
      roles: ['TENANT_ADMIN'],
      jti: 'j',
    },
    grants: [...SYSTEM_ROLES.TENANT_ADMIN.grants],
  };
}
function tenantMember(id = 'u-1'): Actor {
  return {
    auth: {
      id,
      email: 'm@x.test',
      tenantId: TENANT,
      scope: 'tenant',
      roles: ['TENANT_MEMBER'],
      jti: 'j',
    },
    grants: [...SYSTEM_ROLES.TENANT_MEMBER.grants],
  };
}
function platformAdmin(): Actor {
  return {
    auth: { id: 'root', email: 'r@x.test', scope: 'platform', roles: ['PLATFORM_ADMIN'], jti: 'j' },
    grants: [...SYSTEM_ROLES.PLATFORM_ADMIN.grants],
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let repository: Record<
    'findById' | 'update' | 'softDelete' | 'list' | 'count' | 'create' | 'findTenantName',
    Mock
  >;
  let authzRepository: Record<
    'loadRolesWithGrants' | 'rolesForUsers' | 'replaceUserRoles' | 'countActiveWithRoleKey',
    Mock
  >;
  let authz: { current: Mock; currentProfile: Mock; invalidateUsers: Mock };
  let audit: { record: Mock };
  let mail: { sendInvitationMail: Mock };
  let invitations: { issue: Mock; ttlHours: number };

  function act(actor: Actor): AuthContext {
    authz.current.mockReturnValue(
      buildAbility(actor.grants, { id: actor.auth.id, tenantId: actor.auth.tenantId }),
    );
    authz.currentProfile.mockReturnValue({
      userId: actor.auth.id,
      tenantId: actor.auth.tenantId ?? null,
      grants: actor.grants,
    });
    return actor.auth;
  }

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
      findTenantName: vi.fn(() => Promise.resolve('Acme')),
    };
    authzRepository = {
      loadRolesWithGrants: vi.fn(),
      rolesForUsers: vi.fn(() => Promise.resolve(new Map())),
      replaceUserRoles: vi.fn(),
      countActiveWithRoleKey: vi.fn(() => Promise.resolve(1)),
    };
    authz = { current: vi.fn(), currentProfile: vi.fn(), invalidateUsers: vi.fn() };
    audit = { record: vi.fn() };
    const transactions = {
      runInRequestContext: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
    };
    const credentials = { hash: vi.fn(() => Promise.resolve('hashed')) };
    mail = { sendInvitationMail: vi.fn(() => Promise.resolve()) };
    const appConfig: Pick<AppConfig, 'webOrigin' | 'appName'> = {
      webOrigin: 'http://localhost:5173',
      appName: 'Starter App',
    };
    invitations = { issue: vi.fn(() => Promise.resolve('invite-token')), ttlHours: 72 };

    service = new UsersService(
      transactions as never,
      repository as never,
      credentials as never,
      audit,
      authz as never,
      authzRepository as never,
      mail as never,
      invitations as never,
      appConfig as never,
    );
  });

  const body = { email: 'new@example.com', fullName: 'New User', password: 'Password123!' };

  /** The same body minus the password: that absence is what triggers an invitation. */
  function invitationBody(): Omit<typeof body, 'password'> {
    return { email: body.email, fullName: body.fullName };
  }

  describe('read / update / delete', () => {
    it('throws not found when the row is invisible (other tenant or missing)', async () => {
      act(tenantAdmin());
      repository.findById.mockResolvedValue(undefined);

      await expect(service.findOrThrow('u-9')).rejects.toBeInstanceOf(ResourceNotFoundError);
    });

    it('refuses a read the ability denies even if RLS let the row through', async () => {
      act(tenantAdmin());
      repository.findById.mockResolvedValue(makeUser({ id: 'u-2', tenantId: OTHER_TENANT }));

      await expect(service.findOrThrow('u-2')).rejects.toBeInstanceOf(ForbiddenActionError);
    });

    it('lets a member update itself but not change isActive', async () => {
      const member = act(tenantMember('u-1'));
      repository.findById.mockResolvedValue(makeUser({ id: 'u-1' }));
      repository.update.mockResolvedValue(makeUser({ id: 'u-1', fullName: 'Renamed' }));

      await expect(service.update(member, 'u-1', { fullName: 'Renamed' })).resolves.toMatchObject({
        fullName: 'Renamed',
      });
      await expect(service.update(member, 'u-1', { isActive: false })).rejects.toBeInstanceOf(
        ForbiddenActionError,
      );
    });

    it('evicts the cached profile when a user is deactivated', async () => {
      const admin = act(tenantAdmin());
      repository.findById.mockResolvedValue(makeUser({ id: 'u-2' }));
      repository.update.mockResolvedValue(makeUser({ id: 'u-2', isActive: false }));

      await service.update(admin, 'u-2', { isActive: false });

      expect(authz.invalidateUsers).toHaveBeenCalledWith(['u-2']);
    });

    it('does not let an admin delete or deactivate its own account', async () => {
      const admin = act(tenantAdmin('actor'));
      repository.findById.mockResolvedValue(makeUser({ id: 'actor' }));

      await expect(service.remove(admin, 'actor')).rejects.toBeInstanceOf(ForbiddenActionError);
      await expect(service.update(admin, 'actor', { isActive: false })).rejects.toBeInstanceOf(
        ForbiddenActionError,
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('soft-deletes a member and evicts its profile', async () => {
      const admin = act(tenantAdmin());
      repository.findById.mockResolvedValue(makeUser({ id: 'u-2' }));

      await service.remove(admin, 'u-2');

      expect(repository.softDelete).toHaveBeenCalledWith(expect.anything(), 'u-2');
      expect(authz.invalidateUsers).toHaveBeenCalledWith(['u-2']);
    });

    it('refuses to remove the last active tenant admin', async () => {
      const admin = act(tenantAdmin('actor'));
      repository.findById.mockResolvedValue(makeUser({ id: 'u-2' }));
      authzRepository.rolesForUsers.mockResolvedValue(new Map([['u-2', [ROLE_ADMIN]]]));
      authzRepository.countActiveWithRoleKey.mockResolvedValue(0);

      await expect(service.remove(admin, 'u-2')).rejects.toBeInstanceOf(ResourceConflictError);
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('paginates, attaches roles and never exposes the password hash', async () => {
      act(tenantAdmin());
      repository.list.mockResolvedValue([makeUser()]);
      repository.count.mockResolvedValue(1);
      authzRepository.rolesForUsers.mockResolvedValue(new Map([['u-1', [ROLE_MEMBER]]]));

      const result = await service.list({ page: 1, limit: 20, sortOrder: 'desc' });

      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(result.items[0]).not.toHaveProperty('passwordHash');
      expect(result.items[0]?.roles).toEqual([
        { id: ROLE_MEMBER.id, key: 'TENANT_MEMBER', name: 'Tenant member' },
      ]);
    });

    it('passes the search filter to both the page query and the count', async () => {
      act(tenantAdmin());
      repository.list.mockResolvedValue([makeUser()]);
      repository.count.mockResolvedValue(1);

      await service.list({ page: 1, limit: 20, sortOrder: 'desc', search: 'ada' });

      // The count must use the same predicate, or meta.total contradicts the page.
      expect(repository.list).toHaveBeenCalledWith({}, { limit: 20, offset: 0 }, undefined, {
        search: 'ada',
      });
      expect(repository.count).toHaveBeenCalledWith({}, { search: 'ada' });
    });

    it('leaves the filter empty when no search term is given', async () => {
      act(tenantAdmin());
      repository.list.mockResolvedValue([]);
      repository.count.mockResolvedValue(0);

      await service.list({ page: 2, limit: 10, sortOrder: 'asc', sortBy: 'email' });

      expect(repository.list).toHaveBeenCalledWith(
        {},
        { limit: 10, offset: 10 },
        { field: 'email', direction: 'asc' },
        { search: undefined },
      );
      expect(repository.count).toHaveBeenCalledWith({}, { search: undefined });
    });
  });

  describe('resendInvitation', () => {
    it('mints a fresh link and emails it for an account that never accepted', async () => {
      const admin = act(tenantAdmin());
      repository.findById
        .mockResolvedValueOnce(makeUser({ id: 'u-2', isEmailVerified: false }))
        .mockResolvedValueOnce(makeUser({ id: 'actor', fullName: 'Ada Admin' }));

      await service.resendInvitation(admin, 'u-2');

      expect(invitations.issue).toHaveBeenCalledWith('u-2');
      expect(mail.sendInvitationMail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'u1@example.com',
          inviterName: 'Ada Admin',
          acceptUrl: 'http://localhost:5173/accept-invitation?token=invite-token',
        }),
      );
    });

    it('conflicts when the account already accepted its invitation', async () => {
      const admin = act(tenantAdmin());
      repository.findById.mockResolvedValue(makeUser({ id: 'u-2', isEmailVerified: true }));

      await expect(service.resendInvitation(admin, 'u-2')).rejects.toBeInstanceOf(
        ResourceConflictError,
      );
      expect(mail.sendInvitationMail).not.toHaveBeenCalled();
    });

    it('refuses a resend the ability denies (user of another tenant)', async () => {
      const admin = act(tenantAdmin());
      repository.findById.mockResolvedValue(
        makeUser({ id: 'u-2', tenantId: OTHER_TENANT, isEmailVerified: false }),
      );

      await expect(service.resendInvitation(admin, 'u-2')).rejects.toBeInstanceOf(
        ForbiddenActionError,
      );
      expect(invitations.issue).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('emails an invitation and leaves the account unverified when no password is given', async () => {
      const admin = act(tenantAdmin());
      authzRepository.loadRolesWithGrants.mockResolvedValue([ROLE_MEMBER]);
      repository.findById.mockResolvedValue(makeUser({ id: 'actor', fullName: 'Ada Admin' }));

      const withoutPassword = invitationBody();
      await service.create(admin, { ...withoutPassword, roleIds: [ROLE_MEMBER.id] });

      expect(repository.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ isActive: true, isEmailVerified: false }),
      );
      expect(invitations.issue).toHaveBeenCalledWith('new-id');
      expect(mail.sendInvitationMail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: 'new@example.com',
          inviterName: 'Ada Admin',
          tenantName: 'Acme',
          acceptUrl: 'http://localhost:5173/accept-invitation?token=invite-token',
          ttlHours: 72,
        }),
      );
    });

    it('sends no invitation when the admin set the password itself', async () => {
      const admin = act(tenantAdmin());
      authzRepository.loadRolesWithGrants.mockResolvedValue([ROLE_MEMBER]);

      await service.create(admin, { ...body, roleIds: [ROLE_MEMBER.id] });

      expect(mail.sendInvitationMail).not.toHaveBeenCalled();
    });

    it('still returns the created user when the invitation email fails', async () => {
      const admin = act(tenantAdmin());
      authzRepository.loadRolesWithGrants.mockResolvedValue([ROLE_MEMBER]);
      mail.sendInvitationMail.mockRejectedValue(new Error('smtp down'));

      const withoutPassword = invitationBody();

      await expect(
        service.create(admin, { ...withoutPassword, roleIds: [ROLE_MEMBER.id] }),
      ).resolves.toMatchObject({ email: 'new@example.com' });
    });

    it("puts a tenant admin's new user in the admin's own tenant, verified, with the role", async () => {
      const admin = act(tenantAdmin());
      authzRepository.loadRolesWithGrants.mockResolvedValue([ROLE_MEMBER]);

      const result = await service.create(admin, { ...body, roleIds: [ROLE_MEMBER.id] });

      expect(repository.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tenantId: TENANT,
          passwordHash: 'hashed',
          isActive: true,
          isEmailVerified: true,
        }),
      );
      expect(authzRepository.replaceUserRoles).toHaveBeenCalledWith(
        expect.anything(),
        'new-id',
        [ROLE_MEMBER.id],
        'actor',
      );
      expect(result).not.toHaveProperty('passwordHash');
      expect(audit.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'user.create', tenantId: TENANT }),
      );
    });

    it('rejects an unknown or invisible role as not found', async () => {
      const admin = act(tenantAdmin());
      authzRepository.loadRolesWithGrants.mockResolvedValue([]);

      await expect(
        service.create(admin, { ...body, roleIds: [ROLE_MEMBER.id] }),
      ).rejects.toBeInstanceOf(ResourceNotFoundError);
    });

    it('stops a tenant admin from creating in another tenant or a platform user', async () => {
      const admin = act(tenantAdmin());
      authzRepository.loadRolesWithGrants.mockResolvedValue([ROLE_MEMBER]);
      await expect(
        service.create(admin, { ...body, roleIds: [ROLE_MEMBER.id], tenantId: OTHER_TENANT }),
      ).rejects.toBeInstanceOf(ForbiddenActionError);

      authzRepository.loadRolesWithGrants.mockResolvedValue([ROLE_PLATFORM]);
      await expect(
        service.create(admin, { ...body, roleIds: [ROLE_PLATFORM.id] }),
      ).rejects.toBeInstanceOf(ForbiddenActionError);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('stops privilege escalation: a member-level creator cannot hand out admin', async () => {
      // A custom "user manager" can create users but only holds member-level reach.
      const manager: Actor = {
        auth: tenantAdmin('mgr').auth,
        grants: [
          { action: 'create', subject: 'User', preset: 'own_tenant' },
          ...SYSTEM_ROLES.TENANT_MEMBER.grants,
        ],
      };
      const auth = act(manager);
      authzRepository.loadRolesWithGrants.mockResolvedValue([ROLE_ADMIN]);

      await expect(
        service.create(auth, { ...body, roleIds: [ROLE_ADMIN.id] }),
      ).rejects.toBeInstanceOf(ForbiddenActionError);
    });

    it('refuses a member', async () => {
      const member = act(tenantMember());
      authzRepository.loadRolesWithGrants.mockResolvedValue([ROLE_MEMBER]);

      await expect(
        service.create(member, { ...body, roleIds: [ROLE_MEMBER.id] }),
      ).rejects.toBeInstanceOf(ForbiddenActionError);
    });

    it('lets a platform admin pick the tenant, and requires one for tenant roles', async () => {
      const admin = act(platformAdmin());
      authzRepository.loadRolesWithGrants.mockResolvedValue([ROLE_ADMIN]);

      await service.create(admin, { ...body, roleIds: [ROLE_ADMIN.id], tenantId: OTHER_TENANT });
      expect(repository.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ tenantId: OTHER_TENANT }),
      );
      await expect(
        service.create(admin, { ...body, roleIds: [ROLE_ADMIN.id] }),
      ).rejects.toBeInstanceOf(ForbiddenActionError);
    });

    it('creates a tenant-less platform user only for a platform admin', async () => {
      const admin = act(platformAdmin());
      authzRepository.loadRolesWithGrants.mockResolvedValue([ROLE_PLATFORM]);

      await service.create(admin, { ...body, roleIds: [ROLE_PLATFORM.id] });

      expect(repository.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ tenantId: null }),
      );
    });
  });

  describe('setRoles', () => {
    it('replaces roles, audits, and evicts the profile', async () => {
      const admin = act(tenantAdmin());
      repository.findById.mockResolvedValue(makeUser({ id: 'u-2' }));
      authzRepository.rolesForUsers.mockResolvedValue(new Map([['u-2', [ROLE_MEMBER]]]));
      authzRepository.loadRolesWithGrants.mockResolvedValue([ROLE_ADMIN]);

      await service.setRoles(admin, 'u-2', { roleIds: [ROLE_ADMIN.id] });

      expect(authzRepository.replaceUserRoles).toHaveBeenCalledWith(
        expect.anything(),
        'u-2',
        [ROLE_ADMIN.id],
        'actor',
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: 'user.roles.update' }),
      );
      expect(authz.invalidateUsers).toHaveBeenCalledWith(['u-2']);
    });

    it('never lets anyone change their own roles', async () => {
      const admin = act(tenantAdmin('actor'));
      repository.findById.mockResolvedValue(makeUser({ id: 'actor' }));

      await expect(
        service.setRoles(admin, 'actor', { roleIds: [ROLE_MEMBER.id] }),
      ).rejects.toBeInstanceOf(ForbiddenActionError);
    });

    it('keeps the last tenant admin: dropping the admin role is refused', async () => {
      const admin = act(tenantAdmin('actor'));
      repository.findById.mockResolvedValue(makeUser({ id: 'u-2' }));
      authzRepository.rolesForUsers.mockResolvedValue(new Map([['u-2', [ROLE_ADMIN]]]));
      authzRepository.loadRolesWithGrants.mockResolvedValue([ROLE_MEMBER]);
      authzRepository.countActiveWithRoleKey.mockResolvedValue(0);

      await expect(
        service.setRoles(admin, 'u-2', { roleIds: [ROLE_MEMBER.id] }),
      ).rejects.toBeInstanceOf(ResourceConflictError);
      expect(authzRepository.replaceUserRoles).not.toHaveBeenCalled();
    });
  });
});
