import type { TFunction } from 'i18next';
import { z } from 'zod';

export const PHONE_REGEX = /^\+?[0-9]{7,15}$/;
export const MIN_PASSWORD_LENGTH = 8;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RoleScopeName = 'platform' | 'tenant';

export interface CreateUserSchemaOptions {
  /** Only platform actors pick a tenant (and may create platform users). */
  isPlatformActor: boolean;
  /** Scope of a role id, so a platform role means "no tenant". */
  scopeOf: (roleId: string) => RoleScopeName | undefined;
  t: TFunction<'users'>;
}

export interface CreateUserFormValues {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  roleIds: string[];
  tenantId: string;
}

/** A user belongs to a tenant unless every selected role is a platform role. */
export function needsTenant(
  roleIds: readonly string[],
  scopeOf: CreateUserSchemaOptions['scopeOf'],
): boolean {
  return roleIds.some((roleId) => scopeOf(roleId) !== 'platform');
}

export function createUserSchema({
  isPlatformActor,
  scopeOf,
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
      roleIds: z.array(z.string()).min(1, t('create.validation.rolesRequired')),
      tenantId: z.string(),
    })
    .superRefine((value, context) => {
      const scopes = new Set(value.roleIds.map((roleId) => scopeOf(roleId)));
      if (scopes.has('platform') && scopes.size > 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['roleIds'],
          message: t('create.validation.mixedScope'),
        });
        return;
      }
      if (
        isPlatformActor &&
        value.roleIds.length > 0 &&
        needsTenant(value.roleIds, scopeOf) &&
        !UUID_REGEX.test(value.tenantId)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tenantId'],
          message: t('create.validation.tenantRequired'),
        });
      }
    });
}
