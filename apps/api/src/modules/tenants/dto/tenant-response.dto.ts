import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

import { dataEnvelope, pagedEnvelope } from '@/common/index.js';

/** Whitelisted shape of a tenant in API responses (docs/rules/06-api-design.md C6). */
export const tenantResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});

export class TenantEnvelopeDto extends createZodDto(dataEnvelope(tenantResponseSchema)) {}
export class TenantListEnvelopeDto extends createZodDto(pagedEnvelope(tenantResponseSchema)) {}
