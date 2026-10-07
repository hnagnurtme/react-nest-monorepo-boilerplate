import type { z } from 'zod';

import type { userResponseSchema, userRoleResponseSchema } from './dto/index.js';

export type UserRoleResponse = z.infer<typeof userRoleResponseSchema>;

export type UserResponse = z.infer<typeof userResponseSchema>;
