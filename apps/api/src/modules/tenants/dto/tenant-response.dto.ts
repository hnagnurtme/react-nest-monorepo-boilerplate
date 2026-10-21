import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

import { dataEnvelope, pagedEnvelope } from '@/common/index.js';

/**
 * A tenant's logo and postal address. `null` on a tenant that has never been
 * given one — the row is created on first write, not alongside the tenant.
 *
 * `logoUrl` is a presigned GET, regenerated per response and valid for minutes:
 * the bucket is private, and a URL stored in a column would be stale the moment
 * its signature expired.
 */
export const tenantDetailResponseSchema = z.object({
  logoUrl: z.string().url().nullable(),
  addressLine: z.string().nullable(),
  wardCode: z.string().nullable(),
  wardName: z.string().nullable(),
  provinceCode: z.string().nullable(),
  provinceName: z.string().nullable(),
  /** Street, ward and province joined for display: null unless all parts exist. */
  fullAddress: z.string().nullable(),
});

/** Whitelisted shape of a tenant in API responses (docs/rules/06-api-design.md C6). */
export const tenantResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  detail: tenantDetailResponseSchema.nullable(),
});

/** What the browser needs to PUT a logo straight to the bucket. */
export const logoUploadResponseSchema = z.object({
  objectKey: z.string(),
  url: z.string().url(),
  expiresIn: z.number().int(),
  contentType: z.string(),
  maxBytes: z.number().int(),
});

export class TenantEnvelopeDto extends createZodDto(dataEnvelope(tenantResponseSchema)) {}
export class TenantListEnvelopeDto extends createZodDto(pagedEnvelope(tenantResponseSchema)) {}

/** The picker is unpaginated: an account belongs to a handful of tenants. */
export class TenantPickerEnvelopeDto extends createZodDto(
  dataEnvelope(z.array(tenantResponseSchema)),
) {}

export class LogoUploadEnvelopeDto extends createZodDto(dataEnvelope(logoUploadResponseSchema)) {}
