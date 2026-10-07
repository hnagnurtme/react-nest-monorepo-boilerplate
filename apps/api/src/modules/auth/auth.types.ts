import type { RoleScope } from '@repo/shared-types';

/**
 * The user as the outside world may see them. Built explicitly rather than by
 * deleting fields from the row: a whitelist keeps a column added next year from
 * leaking by default (docs/rules/06-api-design.md C6).
 */
export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  tenantId: string | undefined;
  /** 'platform' users sit above every tenant. */
  scope: RoleScope;
  roles: { key: string; name: string }[];
}

export interface AuthBody {
  accessToken: string;
  user: PublicUser;
  /** Present for non-browser clients only; web receives it as an httpOnly cookie. */
  refreshToken?: string;
  /** Present for web clients only; mirrors the readable CSRF cookie. */
  csrfToken?: string;
}

export interface ForgotPasswordResponse {
  message: string;
  expiresInSeconds: number;
}
export interface ResetPasswordResponse {
  message: string;
}
export interface ChangePasswordResponse {
  message: string;
}

export interface CookieInstruction {
  name: string;
  value: string;
  maxAgeMs: number;
  httpOnly: boolean;
  path: string;
}

/**
 * A handler result that also needs `Set-Cookie` headers.
 *
 * The controller returns one of these and `AuthCookieInterceptor` applies it,
 * which is how the auth routes set cookies without any controller touching
 * `Response` (docs/rules/02-backend-nestjs.md B2).
 */
export class AuthResult<T> {
  constructor(
    readonly body: T,
    readonly cookies: CookieInstruction[] = [],
    readonly clearCookies: string[] = [],
  ) {}
}
