import type { RoleScope, UserContext } from '@repo/shared-types';

/**
 * The authenticated caller. Identity comes from the verified access token;
 * tenant, scope and roles come from the authorization profile loaded from the
 * database (so a role change applies immediately, not at token expiry).
 *
 * Extends the shared `UserContext`, which the CASL ability is built from, with
 * the fields that only the API cares about.
 */
export interface AuthContext extends UserContext {
  /** JWT id, so a single access token can be revoked before it expires. */
  jti: string;
  email: string;
  /** 'platform' users sit above every tenant and run in the 'admin' RLS mode. */
  scope: RoleScope;
  /** Role keys, for display and logging only; decisions use the ability. */
  roles: string[];
}

/**
 * Request-scoped facts about the caller's device, extracted by `@ClientInfo()`
 * so controllers never have to touch `Request`
 * (docs/rules/02-backend-nestjs.md B2).
 */
export interface ClientInfo {
  isMobile: boolean;
  ipAddress: string | undefined;
  userAgent: string | undefined;
}
