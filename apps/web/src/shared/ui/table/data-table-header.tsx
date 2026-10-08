import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING_INSET } from '@/shared/ui/focus-ring';

import {
  COLUMN_ALIGN_CLASS,
  COLUMN_WIDTH_CLASS,
  columnAlign,
  columnPriorityClass,
  type DataTableColumn,
} from './column-def';
import { nextSort, type SortState } from './sort-state';

export interface DataTableHeaderProps<T> {
  columns: readonly DataTableColumn<T>[];
  sort: SortState | null;
  /** Omitted makes every column non-sortable, whatever the column says. */
  onSortChange?: ((next: SortState | null) => void) | undefined;
  /** Pre-translated, e.g. "Sort by {{column}}". */
  sortLabel: string;
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

export function DataTableHeader<T>({
  columns,
  sort,
  onSortChange,
  sortLabel,
}: DataTableHeaderProps<T>) {
  return (
    <thead className="bg-muted text-muted-foreground border-border border-b">
      <tr className="h-row-compact">
        {columns.map((column) => {
          const align = columnAlign(column);
          const isSortable = column.sortable === true && onSortChange !== undefined;
          const isSorted = sort?.field === column.id;
          const SortIcon = !isSorted
            ? ChevronsUpDown
            : sort.direction === 'asc'
              ? ArrowUp
              : ArrowDown;

          return (
            <th
              key={column.id}
              scope="col"
              // `none` rather than nothing: a sortable column that announces no
              // sort state reads to a screen reader as plain text.
              aria-sort={isSortable ? (isSorted ? ARIA_SORT[sort.direction] : 'none') : undefined}
              className={cn(
                'text-caption px-4 uppercase',
                COLUMN_ALIGN_CLASS[align],
                COLUMN_WIDTH_CLASS[column.width ?? 'fill'],
                columnPriorityClass(column),
              )}
            >
              {isSortable ? (
                <button
                  type="button"
                  aria-label={sortLabel.replace('{{column}}', column.header)}
                  onClick={() => {
                    onSortChange(nextSort(sort, column.id));
                  }}
                  className={cn(
                    'hover:text-foreground inline-flex cursor-pointer items-center gap-1 uppercase transition-colors',
                    align === 'end' && 'flex-row-reverse',
                    isSorted && 'text-foreground',
                    FOCUS_RING_INSET,
                  )}
                >
                  {column.header}
                  <SortIcon
                    aria-hidden="true"
                    className={cn('size-3', !isSorted && 'opacity-50')}
                  />
                </button>
              ) : (
                column.header
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
