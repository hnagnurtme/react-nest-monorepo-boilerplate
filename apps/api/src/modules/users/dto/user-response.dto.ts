import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

import { dataEnvelope, pagedEnvelope } from '@/common/index.js';

export const userRoleResponseSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
});

/** Whitelisted shape of a user in API responses (docs/rules/06-api-design.md C6). */
export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  phoneNumber: z.string().nullable(),
  roles: z.array(userRoleResponseSchema),
  tenantId: z.string().uuid().nullable(),
  isActive: z.boolean(),
  /**
   * False while an invited account has not followed its emailed link yet. The
   * admin UI keys the "resend invitation" action off this flag.
   */
  isEmailVerified: z.boolean(),
  createdAt: z.string().datetime(),
});

export class UserEnvelopeDto extends createZodDto(dataEnvelope(userResponseSchema)) {}
export class UserListEnvelopeDto extends createZodDto(pagedEnvelope(userResponseSchema)) {}
