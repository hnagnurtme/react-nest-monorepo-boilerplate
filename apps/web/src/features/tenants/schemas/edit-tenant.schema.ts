import type { TFunction } from 'i18next';
import { z } from 'zod';

export interface EditTenantFormValues {
  name: string;
  addressLine: string;
  provinceCode: string;
  wardCode: string;
}

/**
 * Editing a tenant. The slug is absent on purpose: it appears in URLs people
 * have already shared, and `PATCH /tenants/{id}` does not accept it.
 *
 * Same pairing rule as the create form — an address needs a ward, and a ward
 * needs its province — so the message lands on the field rather than in a toast.
 */
export function editTenantSchema(t: TFunction<'tenants'>): z.ZodType<EditTenantFormValues> {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(2, t('create.validation.nameMin'))
        .max(100, t('create.validation.nameMax')),
      addressLine: z.string().trim().max(200, t('create.validation.addressMax')),
      provinceCode: z.string(),
      wardCode: z.string(),
    })
    .refine((value) => value.provinceCode === '' || value.wardCode !== '', {
      message: t('create.validation.wardRequired'),
      path: ['wardCode'],
    })
    .refine((value) => value.addressLine === '' || value.wardCode !== '', {
      message: t('create.validation.wardRequiredForAddress'),
      path: ['wardCode'],
    });
}
