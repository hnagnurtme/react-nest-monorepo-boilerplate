import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

import { pageQuerySchema } from '@/common/index.js';

/** E.164-ish: optional +, 7 to 15 digits. */
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;

const MAX_SEARCH_LENGTH = 100;

/**
 * `search` matches the name or the email, case-insensitively. It is a filter, not
 * a tenant selector: which users are visible is still decided by RLS.
 */
export const listUsersSchema = pageQuerySchema.extend({
  search: z.string().trim().min(1).max(MAX_SEARCH_LENGTH).optional(),
});

export class ListUsersDto extends createZodDto(listUsersSchema) {}

export type ListUsersQuery = z.infer<typeof listUsersSchema>;

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100).optional(),
    phoneNumber: z.string().regex(PHONE_REGEX, 'Invalid phone number').nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export class UpdateUserDto extends createZodDto(updateUserSchema) {}

/**
 * `tenantId` is accepted here, and only here, because a platform admin creates
 * users for any tenant. For a tenant admin the service ignores nothing: a
 * differing value is rejected, and an absent one is filled from the token.
 */
export const createUserSchema = z
  .object({
    email: z.string().email().max(MAX_PASSWORD_LENGTH).toLowerCase().trim(),
    fullName: z.string().trim().min(2).max(100),
    phoneNumber: z.string().regex(PHONE_REGEX, 'Invalid phone number').optional(),
    password: z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH),
    /** At least one; the caller may only hand out roles it already holds. */
    roleIds: z.array(z.string().uuid()).min(1).max(20),
    tenantId: z.string().uuid().optional(),
  })
  .strict();

export class CreateUserDto extends createZodDto(createUserSchema) {}

export const setUserRolesSchema = z
  .object({ roleIds: z.array(z.string().uuid()).min(1).max(20) })
  .strict();

export class SetUserRolesDto extends createZodDto(setUserRolesSchema) {}
