import type { z } from 'zod';

import type {
  logoUploadResponseSchema,
  tenantDetailResponseSchema,
  tenantResponseSchema,
} from './dto/index.js';

export type TenantResponse = z.infer<typeof tenantResponseSchema>;
export type TenantDetailResponse = z.infer<typeof tenantDetailResponseSchema>;
export type LogoUploadResponse = z.infer<typeof logoUploadResponseSchema>;
