import type { z } from 'zod';

import type { permissionOptionSchema, roleResponseSchema } from './dto/index.js';

export type RoleResponse = z.infer<typeof roleResponseSchema>;

export type PermissionOption = z.infer<typeof permissionOptionSchema>;
