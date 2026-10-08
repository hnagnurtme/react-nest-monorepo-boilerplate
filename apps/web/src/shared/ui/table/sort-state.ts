export type SortDirection = 'asc' | 'desc';

export interface SortState {
  /** A column `id`, which must be a field the API allow-lists for `sortBy`. */
  field: string;
  direction: SortDirection;
}

/**
 * Click once to sort ascending, again for descending, a third time to clear.
 * The third click matters: without it a list can never return to the order the
 * API chose, which is usually the only one that puts new rows on page one.
 */
export function nextSort(current: SortState | null, field: string): SortState | null {
  if (current?.field !== field) return { field, direction: 'asc' };
  if (current.direction === 'asc') return { field, direction: 'desc' };
  return null;
}

/** `?sort=createdAt:desc` — one param, so a shared link carries the order. */
export function serializeSort(sort: SortState | null): string {
  return sort === null ? '' : `${sort.field}:${sort.direction}`;
}

export function parseSort(raw: string): SortState | null {
  const [field, direction] = raw.split(':');
  if (field === undefined || field === '') return null;
  return { field, direction: direction === 'desc' ? 'desc' : 'asc' };
}
