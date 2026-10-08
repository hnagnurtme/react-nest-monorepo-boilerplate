import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { Card } from '@/shared/ui/card';

import {
  COLUMN_ALIGN_CLASS,
  COLUMN_WIDTH_CLASS,
  columnAlign,
  columnNumericClass,
  columnPriorityClass,
  type DataTableColumn,
} from './column-def';
import { DataTableHeader } from './data-table-header';
import { DataTableSkeletonRows } from './data-table-skeleton-rows';
import { type SortState } from './sort-state';

/**
 * `empty` and `no-results` are deliberately separate: a list with nothing in it
 * invites you to create the first row, while a filter that matched nothing
 * invites you to clear the filter. Showing one message for both is the single
 * most common list-page mistake. `reloading` keeps the current rows on screen
 * and only marks them stale, so a refetch does not blank the page.
 */
export type DataTableState = 'loading' | 'reloading' | 'ready' | 'empty' | 'no-results' | 'error';

export interface DataTableProps<T> {
  /** Announced to screen readers in place of the visual heading. */
  caption: string;
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** Omitted derives `empty` / `ready` from `rows`. */
  state?: DataTableState;
  /** Skeleton row count while loading; match the page size to avoid a jump. */
  pageSize?: number;
  sort?: SortState | null;
  onSortChange?: ((next: SortState | null) => void) | undefined;
  /** Pre-translated, e.g. "Sort by {{column}}". */
  sortLabel?: string;
  /** Short form of `emptyState` when a sentence is all the page needs. */
  emptyLabel?: string;
  emptyState?: ReactNode;
  noResultsState?: ReactNode;
  errorState?: ReactNode;
  /** `TableToolbar` and `FilterChips`, so search and filters share the card. */
  toolbar?: ReactNode;
  /** `Pagination`, below the rows and inside the same card. */
  footer?: ReactNode;
  /** Dims a row that is archived, revoked or otherwise no longer live. */
  isRowDimmed?: (row: T) => boolean;
  /** Extra classes for one row, e.g. a tint on a row that needs attention. */
  rowClassName?: (row: T) => string | undefined;
}

/**
 * The table shell the admin list pages share. Column definitions stay with the
 * page; the markup, spacing, sort affordance and the four non-data states live
 * here so the list pages cannot drift apart.
 *
 * One DOM tree, two layouts: `data-stacked` switches the rows to a label/value
 * stack on phones (the rules live next to the other global styling, in
 * `globals.css`, because they need `::before { content: attr(data-label) }`).
 * Scrolling a six-column table sideways on a phone is not a responsive design.
 *
 * Rows are a fixed `h-row` rather than padding-sized: a list whose row height
 * follows its content makes the eye re-find the next row on every line, and a
 * row shorter than the controls inside it clips their focus ring.
 *
 * Every state renders *inside* the shell rather than replacing it. A filter that
 * matches nothing must not take away the toolbar that would undo it, and an
 * error must not take away the reload button.
 *
 * There is no row-click prop on purpose. A whole row that navigates has to
 * swallow clicks on every control inside it, and it cannot be reached by
 * keyboard without pretending a `<tr>` is a button. Navigation belongs to a
 * real link in the identity cell — see `IdentityCell`.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  state,
  pageSize = 10,
  sort = null,
  onSortChange,
  sortLabel = 'Sort by {{column}}',
  emptyLabel,
  emptyState,
  noResultsState,
  errorState,
  toolbar,
  footer,
  isRowDimmed,
  rowClassName,
}: DataTableProps<T>) {
  const resolvedState: DataTableState = state ?? (rows.length === 0 ? 'empty' : 'ready');
  const isLoading = resolvedState === 'loading';
  const isReloading = resolvedState === 'reloading';

  const placeholder =
    resolvedState === 'error'
      ? errorState
      : resolvedState === 'no-results'
        ? noResultsState
        : emptyState;

  return (
    <Card isFlush>
      {toolbar}
      {/* A stale-rows marker, not a blocking spinner: the data below still reads. */}
      {isReloading ? <div aria-hidden="true" className="bg-primary h-0.5 animate-pulse" /> : null}
      <table
        data-stacked
        aria-busy={isLoading || isReloading}
        className="text-body w-full text-left"
      >
        <caption className="sr-only">{caption}</caption>
        <DataTableHeader
          columns={columns}
          sort={sort}
          onSortChange={onSortChange}
          sortLabel={sortLabel}
        />
        <tbody className="divide-border divide-y">
          {isLoading ? (
            <DataTableSkeletonRows columns={columns} rowCount={pageSize} />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-muted-foreground px-4 py-10 text-center">
                {placeholder ?? emptyLabel ?? ''}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={cn(
                  'h-row hover:bg-muted/60 group transition-colors',
                  isRowDimmed?.(row) === true && 'text-muted-foreground',
                  rowClassName?.(row),
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    data-label={column.header}
                    className={cn(
                      'px-4 py-2',
                      COLUMN_ALIGN_CLASS[columnAlign(column)],
                      COLUMN_WIDTH_CLASS[column.width ?? 'fill'],
                      columnPriorityClass(column),
                      columnNumericClass(column),
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {footer === undefined ? null : <div className="border-border border-t p-3">{footer}</div>}
    </Card>
  );
}
