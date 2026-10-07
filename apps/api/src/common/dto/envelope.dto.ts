import { z } from 'zod';

import { paginationMetaSchema } from './page-query.dto.js';

/** `{ data }` envelope every response is wrapped in (docs/rules/06-api-design.md). */
export function dataEnvelope<T extends z.ZodTypeAny>(schema: T): z.ZodObject<{ data: T }> {
  return z.object({ data: schema });
}

/** `{ data: [...], meta }` envelope of offset-paginated lists. */
export function pagedEnvelope<T extends z.ZodTypeAny>(
  item: T,
): z.ZodObject<{ data: z.ZodArray<T>; meta: typeof paginationMetaSchema }> {
  return z.object({ data: z.array(item), meta: paginationMetaSchema });
}
