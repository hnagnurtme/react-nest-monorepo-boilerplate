import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

import { ACTIONS, ROLE_SCOPES, SCOPE_PRESETS } from '@repo/shared-types';

import { dataEnvelope, pagedEnvelope } from '@/common/index.js';

export const grantResponseSchema = z.object({
  action: z.enum(ACTIONS),
  subject: z.string(),
  preset: z.enum(SCOPE_PRESETS),
});

export const roleResponseSchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  scope: z.enum(ROLE_SCOPES),
  isSystem: z.boolean(),
  tenantId: z.string().uuid().nullable(),
  permissions: z.array(grantResponseSchema),
});

export const permissionOptionSchema = z.object({
  action: z.string(),
  subject: z.string(),
  description: z.string(),
  /** Reach levels the caller is allowed to hand out for this permission. */
  presets: z.array(z.enum(SCOPE_PRESETS)),
});

export class RoleEnvelopeDto extends createZodDto(dataEnvelope(roleResponseSchema)) {}
export class RoleListEnvelopeDto extends createZodDto(pagedEnvelope(roleResponseSchema)) {}
export class PermissionOptionsEnvelopeDto extends createZodDto(
  dataEnvelope(z.array(permissionOptionSchema)),
) {}
