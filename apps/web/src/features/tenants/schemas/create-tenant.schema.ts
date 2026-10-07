import { z } from 'zod';

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface CreateTenantFormValues {
  name: string;
  slug: string;
}

export function createTenantSchema(t: (key: string) => string): z.ZodType<CreateTenantFormValues> {
  return z.object({
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
      .refine((value) => value === '' || SLUG_REGEX.test(value), t('create.validation.slugFormat')),
  });
}
