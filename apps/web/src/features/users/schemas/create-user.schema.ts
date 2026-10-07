import { z } from 'zod';

import { USER_ROLES, type UserRole } from '@repo/shared-types';

export const PHONE_REGEX = /^\+?[0-9]{7,15}$/;
export const MIN_PASSWORD_LENGTH = 8;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateUserSchemaOptions {
  /** Only platform admins pick a tenant (and may create platform admins). */
  isPlatformAdmin: boolean;
  t: (key: string) => string;
}

export interface CreateUserFormValues {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: UserRole;
  tenantId: string;
}

export function createUserSchema({
  isPlatformAdmin,
  t,
}: CreateUserSchemaOptions): z.ZodType<CreateUserFormValues> {
  return z
    .object({
      fullName: z
        .string()
        .trim()
        .min(2, t('create.validation.fullNameMin'))
        .max(100, t('create.validation.fullNameMax')),
      email: z
        .string()
        .trim()
        .min(1, t('create.validation.emailRequired'))
        .email(t('create.validation.emailInvalid')),
      phoneNumber: z
        .string()
        .trim()
        .refine((value) => value === '' || PHONE_REGEX.test(value), t('create.validation.phone')),
      password: z.string().min(MIN_PASSWORD_LENGTH, t('create.validation.passwordMin')),
      role: z.enum(USER_ROLES),
      tenantId: z.string(),
    })
    .superRefine((value, context) => {
      if (!isPlatformAdmin && value.role === 'PLATFORM_ADMIN') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['role'],
          message: t('create.validation.roleNotAllowed'),
        });
      }
      if (isPlatformAdmin && value.role !== 'PLATFORM_ADMIN' && !UUID_REGEX.test(value.tenantId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tenantId'],
          message: t('create.validation.tenantRequired'),
        });
      }
    });
}
