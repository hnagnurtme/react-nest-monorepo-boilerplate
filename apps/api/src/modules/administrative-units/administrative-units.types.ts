import type { z } from 'zod';

import type { administrativeUnitResponseSchema } from './dto/index.js';

export type AdministrativeUnitResponse = z.infer<typeof administrativeUnitResponseSchema>;
