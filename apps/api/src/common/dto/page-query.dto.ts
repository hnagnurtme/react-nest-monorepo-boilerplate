import { z } from 'zod';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
/** docs/rules/06-api-design.md D1 — enforced here, never trusted from the client. */
const MAX_LIMIT = 100;

/**
 * Offset pagination, the default for every list endpoint.
 * `sortBy` is only a candidate here: the column allowlist lives with the
 * repository that owns the table (see `parseSort`).
 */
export const pageQuerySchema = z
  .object({
    page: z.coerce.number().int().min(DEFAULT_PAGE).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export type PageQuery = z.infer<typeof pageQuerySchema>;

export interface SortSpec<TField extends string> {
  field: TField;
  direction: 'asc' | 'desc';
}

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/**
 * Resolves `sortBy` against an allowlist of sortable fields.
 *
 * Accepting an arbitrary string would let a caller order by an unindexed column
 * (a full table scan on demand) and, with a less careful query builder, inject
 * SQL outright — docs/rules/06-api-design.md D3. An unknown field is treated as
 * "not specified" rather than an error, so a stale bookmark keeps working.
 */
export function parseSort<TField extends string>(
  query: Pick<PageQuery, 'sortBy' | 'sortOrder'>,
  allowed: readonly TField[],
): SortSpec<TField> | undefined {
  const { sortBy, sortOrder } = query;
  if (sortBy === undefined) return undefined;

  const field = allowed.find((candidate) => candidate === sortBy);
  if (field === undefined) return undefined;

  return { field, direction: sortOrder };
}

export function toOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function buildPaginationMeta(query: PageQuery, total: number): PaginationMeta {
  return {
    page: query.page,
    limit: query.limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
  };
}
