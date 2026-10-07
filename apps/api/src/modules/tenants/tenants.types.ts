import type { z } from 'zod';

import type { tenantResponseSchema } from './dto/index.js';

export type TenantResponse = z.infer<typeof tenantResponseSchema>;
