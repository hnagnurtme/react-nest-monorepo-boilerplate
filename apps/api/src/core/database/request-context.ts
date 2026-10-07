import type { ClsStore } from 'nestjs-cls';

import type { AuthContext } from '@/common/index.js';

/**
 * Keys in the request-scoped CLS (AsyncLocalStorage) namespace.
 *
 * Constants rather than inline strings because a typo in `cls.get` returns
 * `undefined` instead of failing — and a missing access context is exactly the
 * condition that must never pass silently.
 */
export const CLS_KEYS = {
  accessContext: 'accessContext',
  authContext: 'authContext',
  userId: 'userId',
  tenantId: 'tenantId',
  traceId: 'traceId',
} as const;

/**
 * The access mode every transaction must declare. There is no default: an
 * unset `app.access_mode` makes every branch of every RLS policy false, so the
 * query returns zero rows instead of leaking across tenants
 * (docs/02-backend-core-va-drizzle-rls.md 2.2).
 *
 * A discriminated union rather than `{ accessMode, tenantId? }` so 'tenant'
 * cannot be requested without a tenant, and 'admin' cannot be requested
 * without saying why.
 */
export type AccessContext =
  { accessMode: 'tenant'; tenantId: string } | { accessMode: 'admin'; reason: string };

export interface AppClsStore extends ClsStore {
  [CLS_KEYS.accessContext]?: AccessContext;
  [CLS_KEYS.authContext]?: AuthContext;
  [CLS_KEYS.userId]?: string;
  [CLS_KEYS.tenantId]?: string;
  [CLS_KEYS.traceId]?: string;
}

/** Transaction-local Postgres settings every RLS policy reads. */
export const ACCESS_MODE_SETTING = 'app.access_mode';
export const TENANT_SETTING = 'app.tenant_id';
