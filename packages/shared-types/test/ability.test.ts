import { subject } from '@casl/ability';
import { describe, expect, it } from 'vitest';

import {
  PERMISSION_CATALOG,
  SYSTEM_ROLES,
  abilityFromPacked,
  buildAbility,
  conditionsFor,
  defineAnonymousAbility,
  findCatalogEntry,
  grantsCover,
  packAbility,
  type PermissionGrant,
} from '@repo/shared-types';

const ADMIN = { id: 'u-1', tenantId: 't-1' };

describe('buildAbility', () => {
  it('anonymous and empty grants allow nothing', () => {
    expect(defineAnonymousAbility().can('read', 'User')).toBe(false);
    expect(buildAbility([], ADMIN).can('read', 'User')).toBe(false);
  });

  it('platform admin (manage all) can do anything except edit a system role', () => {
    const ability = buildAbility(SYSTEM_ROLES.PLATFORM_ADMIN.grants, { id: 'p-1' });

    expect(ability.can('delete', 'Tenant')).toBe(true);
    expect(ability.can('create', 'Role')).toBe(true);
    expect(ability.can('update', subject('Role', { id: 'r', isSystem: false }))).toBe(true);
    expect(ability.can('update', subject('Role', { id: 'r', isSystem: true }))).toBe(false);
    expect(ability.can('delete', subject('Role', { id: 'r', isSystem: true }))).toBe(false);
  });

  it('own_tenant reaches only the caller tenant', () => {
    const ability = buildAbility(SYSTEM_ROLES.TENANT_ADMIN.grants, ADMIN);

    expect(ability.can('delete', subject('User', { id: 'u-2', tenantId: 't-1' }))).toBe(true);
    expect(ability.can('delete', subject('User', { id: 'u-3', tenantId: 't-2' }))).toBe(false);
    expect(ability.can('update', subject('Tenant', { id: 't-1' }))).toBe(true);
    expect(ability.can('update', subject('Tenant', { id: 't-2' }))).toBe(false);
    expect(ability.can('create', 'Tenant')).toBe(false);
  });

  it('a tenant admin may read system roles but never write them', () => {
    const ability = buildAbility(SYSTEM_ROLES.TENANT_ADMIN.grants, ADMIN);
    const system = { id: 'r-1', tenantId: null, isSystem: true };

    expect(ability.can('read', subject('Role', system))).toBe(true);
    expect(ability.can('update', subject('Role', system))).toBe(false);
    expect(ability.can('update', subject('Role', { id: 'r-2', tenantId: 't-1' }))).toBe(true);
    expect(ability.can('update', subject('Role', { id: 'r-3', tenantId: 't-2' }))).toBe(false);
  });

  it('own_record lets a member edit only itself', () => {
    const ability = buildAbility(SYSTEM_ROLES.TENANT_MEMBER.grants, { id: 'u-1', tenantId: 't-1' });

    expect(ability.can('update', subject('User', { id: 'u-1', tenantId: 't-1' }))).toBe(true);
    expect(ability.can('update', subject('User', { id: 'u-2', tenantId: 't-1' }))).toBe(false);
    expect(ability.can('read', subject('User', { id: 'u-2', tenantId: 't-1' }))).toBe(true);
    expect(ability.can('read', subject('User', { id: 'u-3', tenantId: 't-2' }))).toBe(false);
  });

  it('unions several roles', () => {
    const grants: PermissionGrant[] = [
      ...SYSTEM_ROLES.TENANT_MEMBER.grants,
      { action: 'create', subject: 'User', preset: 'own_tenant' },
    ];
    const ability = buildAbility(grants, ADMIN);

    expect(ability.can('create', subject('User', { id: 'new', tenantId: 't-1' }))).toBe(true);
    expect(ability.can('delete', subject('User', { id: 'u-2', tenantId: 't-1' }))).toBe(false);
  });

  it('fails closed: a tenant-scoped preset without a tenant yields no rule', () => {
    expect(
      conditionsFor({ action: 'read', subject: 'User', preset: 'own_tenant' }, { id: 'x' }),
    ).toBe(null);
    expect(conditionsFor({ action: 'read', subject: 'Tenant', preset: 'own_record' }, ADMIN)).toBe(
      null,
    );
  });

  it('a bare string subject ignores conditions (why services must use subject())', () => {
    const ability = buildAbility(SYSTEM_ROLES.TENANT_MEMBER.grants, ADMIN);
    expect(ability.can('update', 'User')).toBe(true);
  });

  it('survives a pack/unpack round trip for the browser', () => {
    const ability = buildAbility(SYSTEM_ROLES.TENANT_ADMIN.grants, ADMIN);
    const restored = abilityFromPacked(packAbility(ability));

    expect(restored.can('delete', subject('User', { id: 'u-2', tenantId: 't-1' }))).toBe(true);
    expect(restored.can('delete', subject('User', { id: 'u-3', tenantId: 't-2' }))).toBe(false);
  });
});

describe('catalog', () => {
  it('has unique entries and every system grant is a real, allowed catalog entry', () => {
    const keys = PERMISSION_CATALOG.map((c) => `${c.action}:${c.subject}`);
    expect(new Set(keys).size).toBe(keys.length);

    for (const role of Object.values(SYSTEM_ROLES)) {
      for (const grant of role.grants) {
        const entry = findCatalogEntry(grant.action, grant.subject);
        expect(entry, `${role.key} ${grant.action}:${grant.subject}`).toBeDefined();
        if (role.scope === 'tenant') {
          expect(entry?.platformOnly).toBe(false);
          expect(entry?.presets).toContain(grant.preset);
        }
      }
    }
  });
});

describe('grantsCover', () => {
  const member = SYSTEM_ROLES.TENANT_MEMBER.grants;
  const admin = SYSTEM_ROLES.TENANT_ADMIN.grants;

  it('lets you grant what you hold, at the same or a narrower reach', () => {
    expect(grantsCover(admin, { action: 'read', subject: 'User', preset: 'own_tenant' })).toBe(
      true,
    );
    expect(grantsCover(admin, { action: 'read', subject: 'User', preset: 'own_record' })).toBe(
      true,
    );
  });

  it('refuses a wider reach or a permission you do not hold', () => {
    expect(grantsCover(member, { action: 'update', subject: 'User', preset: 'own_tenant' })).toBe(
      false,
    );
    expect(grantsCover(member, { action: 'create', subject: 'User', preset: 'own_tenant' })).toBe(
      false,
    );
    expect(grantsCover(admin, { action: 'read', subject: 'User', preset: 'any' })).toBe(false);
    expect(grantsCover(admin, { action: 'create', subject: 'Tenant', preset: 'own_tenant' })).toBe(
      false,
    );
  });

  it('manage:all covers everything', () => {
    expect(
      grantsCover(SYSTEM_ROLES.PLATFORM_ADMIN.grants, {
        action: 'delete',
        subject: 'Tenant',
        preset: 'any',
      }),
    ).toBe(true);
  });
});
