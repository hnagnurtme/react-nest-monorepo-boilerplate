import type { paths } from '@repo/api-contract';

export const AUTH_ENDPOINTS = {
  LOGIN: '/api/v1/auth/login',
  FORGOT_PASSWORD: '/api/v1/auth/forgot-password',
  RESET_PASSWORD: '/api/v1/auth/reset-password',
  ACCEPT_INVITATION: '/api/v1/auth/accept-invitation',
  CHANGE_PASSWORD: '/api/v1/auth/change-password',
  REFRESH: '/api/v1/auth/refresh',
  LOGOUT: '/api/v1/auth/logout',
  ME: '/api/v1/auth/me',
  ABILITIES: '/api/v1/auth/me/abilities',
} as const satisfies Record<string, keyof paths>;

/** The token is appended as a path segment, so this one is not a `paths` key. */
export const AUTH_ENDPOINTS_WITH_PARAM = {
  INVITATION_PREVIEW: '/api/v1/auth/invitation',
} as const;
