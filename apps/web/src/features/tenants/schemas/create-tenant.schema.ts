import type { TFunction } from 'i18next';
import { z } from 'zod';

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** What a signed upload will accept; anything else is refused before signing. */
export const LOGO_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export interface CreateTenantFormValues {
  name: string;
  slug: string;
  addressLine: string;
  provinceCode: string;
  wardCode: string;
}

/**
 * The address is optional as a block but not in halves: a province without a
 * ward is the state the form leaves someone in halfway through, and the API
 * rejects it, so the message belongs here rather than in a toast.
 */
export function createTenantSchema(t: TFunction<'tenants'>): z.ZodType<CreateTenantFormValues> {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(2, t('create.validation.nameMin'))
        .max(100, t('create.validation.nameMax')),
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .max(60, t('create.validation.slugMax'))
        .refine(
          (value) => value === '' || SLUG_REGEX.test(value),
          t('create.validation.slugFormat'),
        ),
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
