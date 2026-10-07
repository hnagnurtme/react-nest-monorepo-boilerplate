import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

import { pageQuerySchema, slugify } from '@/common/index.js';

export class ListTenantsDto extends createZodDto(pageQuerySchema) {}

const NAME = z.string().trim().min(2).max(100);

export const createTenantSchema = z
  .object({
    name: NAME,
    /** Defaults to a slug derived from the name. */
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and hyphens')
      .max(60)
      .optional(),
  })
  .strict()
  .transform((value) => ({ name: value.name, slug: value.slug ?? slugify(value.name) }))
  .refine((value) => value.slug.length > 0, { message: 'Could not derive a slug', path: ['slug'] });

export class CreateTenantDto extends createZodDto(createTenantSchema) {}

export const updateTenantSchema = z
  .object({ name: NAME.optional(), isActive: z.boolean().optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export class UpdateTenantDto extends createZodDto(updateTenantSchema) {}
