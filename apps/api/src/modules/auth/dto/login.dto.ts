import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;

/**
 * `.strict()` is what replaces `forbidNonWhitelisted`: an unexpected field is
 * rejected outright rather than quietly dropped, so a client that thinks it is
 * sending `tenantId` finds out immediately.
 */
export const loginSchema = z
  .object({
    email: z.string().email().max(MAX_PASSWORD_LENGTH).toLowerCase().trim(),
    // Bounded so a megabyte-long password cannot turn Argon2 into a CPU DoS.
    password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
  })
  .strict();

export class LoginDto extends createZodDto(loginSchema) {}

/** Mobile clients have no cookie jar, so they hand the token back in the body. */
export const refreshSchema = z
  .object({ refreshToken: z.string().min(1).optional() })
  .strict()
  // A browser sends no body at all (the token rides in the cookie), and Express 5
  // leaves `req.body` undefined then — without this default that is a 422.
  .default({});

export class RefreshDto extends createZodDto(refreshSchema) {}
