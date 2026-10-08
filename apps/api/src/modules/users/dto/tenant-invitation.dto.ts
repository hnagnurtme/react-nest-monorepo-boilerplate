import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

import { dataEnvelope } from '@/common/index.js';

const MAX_EMAIL_LENGTH = 128;

/**
 * `tenantId` is accepted for the same reason as on `POST /users`: a platform
 * admin has to say which tenant the account is being invited to. A tenant
 * caller may omit it, and may not name another tenant.
 */
export const inviteToTenantSchema = z
  .object({
    email: z.string().email().max(MAX_EMAIL_LENGTH).toLowerCase().trim(),
    /** At least one; the caller may only hand out roles it already holds. */
    roleIds: z.array(z.string().uuid()).min(1).max(20),
    tenantId: z.string().uuid().optional(),
  })
  .strict();

export class InviteToTenantDto extends createZodDto(inviteToTenantSchema) {}

export const acceptTenantInvitationSchema = z.object({ token: z.string().min(1) }).strict();

export class AcceptTenantInvitationDto extends createZodDto(acceptTenantInvitationSchema) {}

/**
 * What the acceptance screen shows before the invitee commits. Deliberately
 * thin: the token is a bearer credential sent by email, so it buys the tenant
 * name and nothing about the other members.
 */
export const tenantInvitationPreviewSchema = z.object({
  email: z.string().email(),
  tenantName: z.string(),
  inviterName: z.string(),
  roles: z.array(z.string()),
});

export class TenantInvitationPreviewEnvelopeDto extends createZodDto(
  dataEnvelope(tenantInvitationPreviewSchema),
) {}

/** A pending invitation as the tenant's admin UI lists it. */
export const tenantInvitationSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  roles: z.array(z.string()),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export class TenantInvitationListEnvelopeDto extends createZodDto(
  dataEnvelope(z.array(tenantInvitationSummarySchema)),
) {}
