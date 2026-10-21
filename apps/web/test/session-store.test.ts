import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/entities/session';

import { makePlatformAdmin, makeUser } from './fixtures/auth';

const ACTIVE_TENANT_KEY = 'active_tenant_id';

describe('session store: the active tenant', () => {
  beforeEach(() => {
    globalThis.sessionStorage.clear();
    useAuthStore.getState().clearAuth();
  });

  it('keeps a platform account on the tenant it chose', () => {
    // The choice is the tab's, and `GET /auth/me` is answered on every reload
    // and every refresh: dropping it here put the account back on the chooser
    // one render after it had chosen.
    globalThis.sessionStorage.setItem(ACTIVE_TENANT_KEY, 'tenant-9');

    useAuthStore.getState().setAuth('token', makePlatformAdmin());

    expect(useAuthStore.getState().activeTenantId).toBe('tenant-9');

    useAuthStore.getState().setUser(makePlatformAdmin());

    expect(useAuthStore.getState().activeTenantId).toBe('tenant-9');
  });

  it("drops a tenant account's stored choice once it is not a membership", () => {
    globalThis.sessionStorage.setItem(ACTIVE_TENANT_KEY, 'tenant-9');

    useAuthStore.getState().setAuth(
      'token',
      makeUser({
        tenants: [
          { id: 'tenant-1', name: 'Acme', slug: 'acme' },
          { id: 'tenant-2', name: 'Globex', slug: 'globex' },
        ],
      }),
    );

    // Two memberships and none of them the stored one: the choice is missing,
    // not guessed, and the picker asks again.
    expect(useAuthStore.getState().activeTenantId).toBeNull();
    expect(globalThis.sessionStorage.getItem(ACTIVE_TENANT_KEY)).toBeNull();
  });

  it('chooses the only membership rather than showing a one-item picker', () => {
    useAuthStore.getState().setAuth('token', makeUser());

    expect(useAuthStore.getState().activeTenantId).toBe('tenant-1');
  });

  it('forgets the tenant on sign-out', () => {
    useAuthStore.getState().setAuth('token', makeUser());
    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().activeTenantId).toBeNull();
    expect(globalThis.sessionStorage.getItem(ACTIVE_TENANT_KEY)).toBeNull();
  });
});
