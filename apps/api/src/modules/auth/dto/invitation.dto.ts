import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

import { dataEnvelope } from '@/common/index.js';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;
/** 32 random bytes, base64url: 43 characters. Bounded so a huge body is cheap to reject. */
const MAX_TOKEN_LENGTH = 128;

export const invitationTokenSchema = z.string().trim().min(1).max(MAX_TOKEN_LENGTH);

export const acceptInvitationSchema = z
  .object({
    token: invitationTokenSchema,
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Mật khẩu phải có ít nhất ${String(MIN_PASSWORD_LENGTH)} ký tự`)
      .max(MAX_PASSWORD_LENGTH),
  })
  .strict();

export class AcceptInvitationDto extends createZodDto(acceptInvitationSchema) {}

/**
 * Deliberately thin: this endpoint is public, so it only confirms what the
 * holder of the link already knows and nothing that would turn a guessed token
 * into a directory lookup.
 */
export const invitationPreviewSchema = z.object({
  email: z.string().email(),
  fullName: z.string(),
  tenantName: z.string(),
});

export class InvitationPreviewEnvelopeDto extends createZodDto(
  dataEnvelope(invitationPreviewSchema),
) {}
