import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

import { dataEnvelope } from '@/common/index.js';

export const administrativeUnitResponseSchema = z.object({
  /** GSO code, zero-padded: two digits for a province, five for a ward. */
  code: z.string(),
  /** With its designation, as a picker shows it: `Phường Tân Phú`. */
  name: z.string(),
  /** With its province, for an address line: `Phường Tân Phú, Thành phố Hồ Chí Minh`. */
  fullName: z.string(),
  /** A ward's province; null on a province. */
  parentCode: z.string().nullable(),
});

export class ProvinceListEnvelopeDto extends createZodDto(
  dataEnvelope(z.array(administrativeUnitResponseSchema)),
) {}

export class WardListEnvelopeDto extends createZodDto(
  dataEnvelope(z.array(administrativeUnitResponseSchema)),
) {}
