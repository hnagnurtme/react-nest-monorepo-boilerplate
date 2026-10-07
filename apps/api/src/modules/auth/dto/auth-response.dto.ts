import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

import { ROLE_SCOPES } from '@repo/shared-types';

import { dataEnvelope } from '@/common/index.js';

/**
 * The user as the outside world may see them. A whitelist, so a column added
 * next year cannot leak by default (docs/rules/06-api-design.md C6).
 */
export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  tenantId: z.string().optional(),
  /** 'platform' users sit above every tenant. */
  scope: z.enum(ROLE_SCOPES),
  roles: z.array(z.object({ key: z.string(), name: z.string() })),
});

export const authBodySchema = z.object({
  accessToken: z.string(),
  user: publicUserSchema,
  /** Present for non-browser clients only; web receives it as an httpOnly cookie. */
  refreshToken: z.string().optional(),
  /** Present for web clients only; mirrors the readable CSRF cookie. */
  csrfToken: z.string().optional(),
});

export const forgotPasswordResponseSchema = z.object({
  message: z.string(),
  expiresInSeconds: z.number().int(),
});

export const messageResponseSchema = z.object({ message: z.string() });

/** Packed CASL rules; the web feeds them to `abilityFromPacked`. */
export const abilitiesResponseSchema = z.object({ rules: z.array(z.unknown()) });

export class AuthBodyEnvelopeDto extends createZodDto(dataEnvelope(authBodySchema)) {}
export class PublicUserEnvelopeDto extends createZodDto(dataEnvelope(publicUserSchema)) {}
export class ForgotPasswordEnvelopeDto extends createZodDto(
  dataEnvelope(forgotPasswordResponseSchema),
) {}
export class MessageEnvelopeDto extends createZodDto(dataEnvelope(messageResponseSchema)) {}
export class AbilitiesEnvelopeDto extends createZodDto(dataEnvelope(abilitiesResponseSchema)) {}
