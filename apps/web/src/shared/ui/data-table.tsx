import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Card } from './card';

export interface DataTableColumn<T> {
  /** Stable identity for the column; also the React key. */
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  emptyLabel: string;
}

/**
 * The table shell the admin list pages share. Column definitions stay with the
 * page; the markup, spacing and empty state live here so the three pages cannot
 * drift apart.
 */
export function DataTable<T>({ columns, rows, rowKey, emptyLabel }: DataTableProps<T>) {
  return (
    <Card isFlush className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className="px-4 py-2 font-medium">
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
                  <td key={column.key} className={cn('px-4 py-2', column.className)}>
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
