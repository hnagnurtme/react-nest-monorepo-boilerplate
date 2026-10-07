import type { paths } from '@repo/api-contract';

export const SYSTEM_ENDPOINTS = {
  HEALTH: '/healthz',
} as const satisfies Record<string, keyof paths>;
