import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

import { pageQuerySchema } from '@/common/index.js';

export class ListUsersDto extends createZodDto(pageQuerySchema) {}

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100).optional(),
    phoneNumber: z
      .string()
      .regex(/^(0|\+84)[3|5|7|8|9][0-9]{8}$/, 'Invalid phone number')
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export class UpdateUserDto extends createZodDto(updateUserSchema) {}
