import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

import { pageQuerySchema, slugify } from '@/common/index.js';
import { IMAGE_CONTENT_TYPES } from '@/integrations/storage/index.js';

export class ListTenantsDto extends createZodDto(pageQuerySchema) {}

const NAME = z.string().trim().min(2).max(100);

/** House number and street. The catalog supplies everything below it. */
const ADDRESS_LINE = z.string().trim().min(1).max(200);
/** GSO codes are zero-padded digits: two for a province, five for a ward. */
const UNIT_CODE = z
  .string()
  .trim()
  .regex(/^[0-9]{2,5}$/, 'Use a zero-padded administrative unit code');
/** Produced by `POST /tenants/:id/logo/upload-url`; never invented by a client. */
const OBJECT_KEY = z.string().trim().min(1).max(512);

/**
 * A tenant's postal address. Every field is optional and nullable: a tenant may
 * have no address at all, and `null` is how a caller clears one it set.
 *
 * `wardCode` and `provinceCode` travel together — the database CHECK rejects
 * half an address, and the service checks the ward really sits in the province,
 * which no constraint can do across tables.
 */
const detailSchema = z
  .object({
    addressLine: ADDRESS_LINE.nullable().optional(),
    wardCode: UNIT_CODE.nullable().optional(),
    provinceCode: UNIT_CODE.nullable().optional(),
    logoObjectKey: OBJECT_KEY.nullable().optional(),
  })
  .strict()
  .refine(
    (value) => {
      // Absent counts as "not touched", so a patch of `addressLine` alone is
      // fine; only naming one half of the pair is the mistake worth rejecting.
      const hasWard = (value.wardCode ?? null) !== null;
      const hasProvince = (value.provinceCode ?? null) !== null;
      return hasWard === hasProvince;
    },
    { message: 'wardCode and provinceCode must be set or cleared together', path: ['wardCode'] },
  );

export const createTenantSchema = z
  .object({
    name: NAME,
    detail: detailSchema.optional(),
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
  .transform((value) => ({
    name: value.name,
    slug: value.slug ?? slugify(value.name),
    ...(value.detail === undefined ? {} : { detail: value.detail }),
  }))
  .refine((value) => value.slug.length > 0, { message: 'Could not derive a slug', path: ['slug'] });

export class CreateTenantDto extends createZodDto(createTenantSchema) {}

export const updateTenantSchema = z
  .object({
    name: NAME.optional(),
    isActive: z.boolean().optional(),
    detail: detailSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export class UpdateTenantDto extends createZodDto(updateTenantSchema) {}

/**
 * Asks for a signed PUT. The key is built server-side from the tenant id, so a
 * caller cannot aim an upload at another tenant's prefix; `contentType` is part
 * of the signature, which is why the browser has to send back the same header.
 */
export const logoUploadUrlSchema = z.object({ contentType: z.enum(IMAGE_CONTENT_TYPES) }).strict();

export class LogoUploadUrlDto extends createZodDto(logoUploadUrlSchema) {}
