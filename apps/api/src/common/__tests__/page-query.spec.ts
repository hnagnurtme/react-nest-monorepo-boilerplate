import { describe, expect, it } from 'vitest';

import { buildPaginationMeta, pageQuerySchema, parseSort, toOffset } from '@/common/dto/index.js';

const SORTABLE = ['createdAt', 'title'] as const;

describe('pageQuerySchema', () => {
  it('applies the documented defaults when nothing is supplied', () => {
    expect(pageQuerySchema.parse({})).toEqual({ page: 1, limit: 20, sortOrder: 'desc' });
  });

  it('coerces the strings Express produces for query parameters', () => {
    const parsed = pageQuerySchema.parse({ page: '3', limit: '50' });

    expect(parsed.page).toBe(3);
    expect(parsed.limit).toBe(50);
  });

  it('refuses a limit above 100 instead of silently clamping it', () => {
    // Silently clamping would let a client believe it received everything.
    expect(pageQuerySchema.safeParse({ limit: 1000 }).success).toBe(false);
  });

  it('rejects an unknown field rather than dropping it', () => {
    expect(pageQuerySchema.safeParse({ tenantId: 'someone-elses' }).success).toBe(false);
  });
});

describe('parseSort', () => {
  it('resolves a whitelisted field', () => {
    expect(parseSort({ sortBy: 'title', sortOrder: 'asc' }, SORTABLE)).toEqual({
      field: 'title',
      direction: 'asc',
    });
  });

  it('ignores a field outside the allowlist', () => {
    // An arbitrary column would mean an unindexed sort at best and SQL
    // injection at worst.
    expect(parseSort({ sortBy: 'password_hash', sortOrder: 'asc' }, SORTABLE)).toBeUndefined();
  });

  it('treats a missing sortBy as unspecified', () => {
    expect(parseSort({ sortOrder: 'desc' }, SORTABLE)).toBeUndefined();
  });
});

describe('buildPaginationMeta', () => {
  it('rounds the page count up so the last partial page is reachable', () => {
    const meta = buildPaginationMeta({ page: 1, limit: 20, sortOrder: 'desc' }, 137);

    expect(meta).toEqual({ page: 1, limit: 20, total: 137, totalPages: 7 });
  });

  it('reports zero pages for an empty result, not one empty page', () => {
    const meta = buildPaginationMeta({ page: 1, limit: 20, sortOrder: 'desc' }, 0);

    expect(meta.totalPages).toBe(0);
  });
});

describe('toOffset', () => {
  it('maps the first page to offset zero', () => {
    expect(toOffset(1, 20)).toBe(0);
  });

  it('skips the preceding pages', () => {
    expect(toOffset(4, 25)).toBe(75);
  });
});
