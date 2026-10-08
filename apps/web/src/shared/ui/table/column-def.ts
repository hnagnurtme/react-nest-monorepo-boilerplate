import { type ReactNode } from 'react';

/**
 * What the column holds, which is enough to decide how it is drawn. A `number`
 * column aligns right and uses tabular figures; a `status` column skeletons as a
 * short chip rather than a full-width bar. Declaring the kind once beats every
 * page re-deciding, and re-deciding differently.
 */
export type ColumnKind =
  'text' | 'identity' | 'code' | 'number' | 'datetime' | 'boolean' | 'status' | 'badge' | 'actions';

export type ColumnAlign = 'start' | 'center' | 'end';

/** Fixed widths so a cell's content cannot push the layout around between pages. */
export type ColumnWidth = 'xs' | 'sm' | 'md' | 'lg' | 'fill';

export interface DataTableColumn<T> {
  /** Stable identity, the React key, and the `sortBy` value when `sortable`. */
  id: string;
  header: string;
  /** Renders only. Formatting belongs in `shared/hooks/use-formatters`. */
  cell: (row: T) => ReactNode;
  kind?: ColumnKind;
  align?: ColumnAlign;
  width?: ColumnWidth;
  /**
   * Sortable columns must name a field the API allow-lists for `sortBy`; the
   * server rejects anything else, so a guess here is a 422 at runtime.
   */
  sortable?: boolean;
  /**
   * 1 (default) shows at every width; 2 drops below `lg`, 3 below `xl`. Below
   * `md` the table stacks instead, so every column comes back.
   */
  priority?: 1 | 2 | 3;
  /** `false` keeps the column out of the visibility menu (identity, actions). */
  hideable?: boolean;
  className?: string;
}

export const COLUMN_WIDTH_CLASS: Record<ColumnWidth, string> = {
  xs: 'w-20',
  sm: 'w-32',
  md: 'w-48',
  lg: 'w-72',
  fill: 'w-auto',
};

export const COLUMN_ALIGN_CLASS: Record<ColumnAlign, string> = {
  start: 'text-left',
  center: 'text-center',
  end: 'text-right',
};

const DEFAULT_ALIGN_BY_KIND: Partial<Record<ColumnKind, ColumnAlign>> = {
  number: 'end',
  actions: 'end',
  boolean: 'center',
};

export function columnAlign<T>(column: DataTableColumn<T>): ColumnAlign {
  return column.align ?? DEFAULT_ALIGN_BY_KIND[column.kind ?? 'text'] ?? 'start';
}

/**
 * The responsive class, not a media query at the call site: `hidden` plus a
 * breakpoint `table-cell` is the only way to drop a column without leaving a
 * hole in the row.
 */
export function columnPriorityClass<T>(column: DataTableColumn<T>): string {
  if (column.priority === 2) return 'hidden lg:table-cell';
  if (column.priority === 3) return 'hidden xl:table-cell';
  return 'table-cell';
}

/** Numbers and timestamps must not shift sideways as their digits change. */
export function columnNumericClass<T>(column: DataTableColumn<T>): string {
  return column.kind === 'number' || column.kind === 'datetime' || column.kind === 'code'
    ? 'tabular-nums'
    : '';
}
