import type { z } from 'zod';

import type {
  authBodySchema,
  invitationPreviewSchema,
  forgotPasswordResponseSchema,
  messageResponseSchema,
  publicUserSchema,
} from './dto/index.js';

export type PublicUser = z.infer<typeof publicUserSchema>;

export type AuthBody = z.infer<typeof authBodySchema>;

export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>;

export type ResetPasswordResponse = z.infer<typeof messageResponseSchema>;

export type ChangePasswordResponse = z.infer<typeof messageResponseSchema>;

export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export type AcceptInvitationResponse = z.infer<typeof messageResponseSchema>;

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
