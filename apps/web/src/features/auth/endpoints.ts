import type { paths } from '@repo/api-contract';

export const AUTH_ENDPOINTS = {
  LOGIN: '/api/v1/auth/login',
  FORGOT_PASSWORD: '/api/v1/auth/forgot-password',
  RESET_PASSWORD: '/api/v1/auth/reset-password',
  CHANGE_PASSWORD: '/api/v1/auth/change-password',
  REFRESH: '/api/v1/auth/refresh',
  LOGOUT: '/api/v1/auth/logout',
  ME: '/api/v1/auth/me',
} as const satisfies Record<string, keyof paths>;
