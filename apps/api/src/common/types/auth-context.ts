import type { UserContext } from '@repo/shared-types';

/**
 * The authenticated caller, as reconstructed from a verified access token.
 *
 * Extends the shared `UserContext` (which CASL builds abilities from and the
 * frontend also uses) with the two fields that only the API cares about.
 */
export interface AuthContext extends UserContext {
  /** JWT id, so a single access token can be revoked before it expires. */
  jti: string;
  email: string;
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
