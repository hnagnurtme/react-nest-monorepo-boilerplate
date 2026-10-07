import { create } from 'zustand';

import type { operations } from '@repo/api-contract';
import type { UserContext } from '@repo/shared-types';

/** The signed-in user as returned by login/refresh/me (typed by the API contract). */
export type PublicUser =
  operations['AuthController_me_v1']['responses'][200]['content']['application/json']['data'];

export type SessionStatus = 'initializing' | 'authenticated' | 'anonymous';

interface AuthState {
  status: SessionStatus;
  accessToken: string | null;
  user: PublicUser | null;
  isAuthenticated: boolean;
  setAuth: (accessToken: string, user: PublicUser) => void;
  setUser: (user: PublicUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'initializing',
  accessToken: null,
  user: null,
  get isAuthenticated() {
    return get().status === 'authenticated';
  },
  setAuth: (accessToken, user) => {
    set({ status: 'authenticated', accessToken, user });
  },
  setUser: (user) => {
    set({ user });
  },
  clearAuth: () => {
    set({ status: 'anonymous', accessToken: null, user: null });
  },
}));

export function toUserContext(user: PublicUser): UserContext {
  return { id: user.id, tenantId: user.tenantId };
}

export function selectUserContext(state: AuthState): UserContext | null {
  return state.user ? toUserContext(state.user) : null;
}
