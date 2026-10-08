import { create } from 'zustand';

import type { operations } from '@repo/api-contract';
import type { UserContext } from '@repo/shared-types';

/** The signed-in user as returned by login/refresh/me (typed by the API contract). */
export type PublicUser =
  operations['AuthController_me_v1']['responses'][200]['content']['application/json']['data'];

export type SessionStatus = 'initializing' | 'authenticated' | 'anonymous';

export type TenantMembership = PublicUser['tenants'][number];

/**
 * Per tab, not per browser: `sessionStorage` lets one tab work in Acme while
 * another works in Globex, and still survives a reload. It is a preference, not
 * a credential — the API validates every choice against the account's
 * memberships.
 */
const ACTIVE_TENANT_KEY = 'active_tenant_id';

function readStoredTenantId(): string | null {
  try {
    return globalThis.sessionStorage.getItem(ACTIVE_TENANT_KEY);
  } catch {
    // Private mode, blocked storage, no window at all: the user picks again.
    return null;
  }
}

function writeStoredTenantId(tenantId: string | null): void {
  try {
    if (tenantId === null) globalThis.sessionStorage.removeItem(ACTIVE_TENANT_KEY);
    else globalThis.sessionStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
  } catch {
    // Not being able to remember the choice is not worth failing a render over.
  }
}

interface AuthState {
  status: SessionStatus;
  accessToken: string | null;
  user: PublicUser | null;
  /** The tenant this tab acts in; `null` for a platform user or before the choice. */
  activeTenantId: string | null;
  isAuthenticated: boolean;
  setAuth: (accessToken: string, user: PublicUser) => void;
  setUser: (user: PublicUser) => void;
  setActiveTenant: (tenantId: string | null) => void;
  clearAuth: () => void;
}

/**
 * The stored choice, but only while it is still one of the account's tenants.
 * With a single membership there is nothing to choose, so it is chosen here
 * instead of showing a one-item picker.
 */
function resolveActiveTenant(user: PublicUser, stored: string | null): string | null {
  if (user.scope === 'platform') return null;
  if (stored !== null && user.tenants.some((tenant) => tenant.id === stored)) return stored;
  const [only] = user.tenants;
  return user.tenants.length === 1 && only !== undefined ? only.id : null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'initializing',
  accessToken: null,
  user: null,
  activeTenantId: null,
  get isAuthenticated() {
    return get().status === 'authenticated';
  },
  setAuth: (accessToken, user) => {
    const activeTenantId = resolveActiveTenant(user, readStoredTenantId());
    writeStoredTenantId(activeTenantId);
    set({ status: 'authenticated', accessToken, user, activeTenantId });
  },
  setUser: (user) => {
    const activeTenantId = resolveActiveTenant(user, get().activeTenantId);
    writeStoredTenantId(activeTenantId);
    set({ user, activeTenantId });
  },
  setActiveTenant: (tenantId) => {
    writeStoredTenantId(tenantId);
    set({ activeTenantId: tenantId });
  },
  clearAuth: () => {
    writeStoredTenantId(null);
    set({ status: 'anonymous', accessToken: null, user: null, activeTenantId: null });
  },
}));

export function toUserContext(user: PublicUser, activeTenantId?: string | null): UserContext {
  return { id: user.id, tenantId: activeTenantId ?? user.tenantId };
}

export function selectUserContext(state: AuthState): UserContext | null {
  return state.user ? toUserContext(state.user, state.activeTenantId) : null;
}
