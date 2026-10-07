import { subject } from '@casl/ability';
import { describe, expect, it } from 'vitest';

import { defineAbilityFor, defineAnonymousAbility, type UserContext } from '@repo/shared-types';

describe('CASL ability definition', () => {
  it('anonymous ability allows nothing', () => {
    const ability = defineAnonymousAbility();
    expect(ability.can('read', 'User')).toBe(false);
    expect(ability.can('manage', 'all')).toBe(false);
  });

  it('PLATFORM_ADMIN can manage everything', () => {
    const user: UserContext = { id: 'admin-1', role: 'PLATFORM_ADMIN' };
    const ability = defineAbilityFor(user);
    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('delete', 'User')).toBe(true);
  });

  it('a tenant role without a tenant has no abilities', () => {
    const ability = defineAbilityFor({ id: 'u-1', role: 'TENANT_ADMIN' });
    expect(ability.can('read', 'User')).toBe(false);
  });

  it('TENANT_MEMBER reads own-tenant users and updates only itself', () => {
    const ability = defineAbilityFor({ id: 'u-1', role: 'TENANT_MEMBER', tenantId: 't-1' });

    expect(ability.can('read', subject('User', { id: 'u-2', tenantId: 't-1' }))).toBe(true);
    expect(ability.can('read', subject('User', { id: 'u-3', tenantId: 't-2' }))).toBe(false);
    expect(ability.can('update', subject('User', { id: 'u-1', tenantId: 't-1' }))).toBe(true);
    expect(ability.can('update', subject('User', { id: 'u-2', tenantId: 't-1' }))).toBe(false);
    expect(ability.can('update', subject('Tenant', { id: 't-1' }))).toBe(false);
  });

  it('TENANT_ADMIN manages users of its own tenant only', () => {
    const ability = defineAbilityFor({ id: 'u-1', role: 'TENANT_ADMIN', tenantId: 't-1' });

    expect(ability.can('delete', subject('User', { id: 'u-2', tenantId: 't-1' }))).toBe(true);
    expect(ability.can('delete', subject('User', { id: 'u-3', tenantId: 't-2' }))).toBe(false);
    expect(ability.can('update', subject('Tenant', { id: 't-1' }))).toBe(true);
    expect(ability.can('update', subject('Tenant', { id: 't-2' }))).toBe(false);
  });

  it('a bare string subject ignores conditions (why services must use subject())', () => {
    const ability = defineAbilityFor({ id: 'u-1', role: 'TENANT_MEMBER', tenantId: 't-1' });
    expect(ability.can('update', 'User')).toBe(true);
  });
});
