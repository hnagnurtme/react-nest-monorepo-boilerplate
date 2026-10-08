import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Card } from './card';

export interface DataTableColumn<T> {
  /** Stable identity for the column; also the React key. */
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /**
   * `secondary` columns are dropped on phones instead of forcing a sideways
   * scroll. Default `primary`, which is kept at every width.
   */
  priority?: 'primary' | 'secondary';
}

export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  emptyLabel: string;
}

/**
 * The table shell the admin list pages share. Column definitions stay with the
 * page; the markup, spacing and empty state live here so the list pages cannot
 * drift apart.
 *
 * One DOM tree, two layouts: `data-stacked` switches the rows to a label/value
 * stack on phones (the rules live next to the other global styling, in
 * `globals.css`, because they need `::before { content: attr(data-label) }`).
 * Scrolling a six-column table sideways on a phone is not a responsive design.
 */
export function DataTable<T>({ columns, rows, rowKey, emptyLabel }: DataTableProps<T>) {
  const columnClass = (column: DataTableColumn<T>): string =>
    column.priority === 'secondary' ? 'hidden md:table-cell' : '';

  return (
    <Card isFlush>
      <table data-stacked className="text-body w-full text-left">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn('px-4 py-2 font-medium', columnClass(column))}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-muted-foreground px-4 py-6 text-center">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="border-border border-t">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    data-label={column.header}
                    className={cn('px-4 py-2', columnClass(column), column.className)}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}
