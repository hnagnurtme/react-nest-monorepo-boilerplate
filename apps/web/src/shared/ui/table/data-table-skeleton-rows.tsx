import { cn } from '@/lib/utils';
import { Skeleton } from '@/shared/ui/skeleton';

import { COLUMN_WIDTH_CLASS, columnPriorityClass, type DataTableColumn } from './column-def';

export interface DataTableSkeletonRowsProps<T> {
  columns: readonly DataTableColumn<T>[];
  rowCount: number;
}

/**
 * The placeholder takes the shape of the cell it stands in — a short chip for a
 * status, two lines for an identity — so nothing jumps when the data lands. A
 * grid of identical grey bars is a loading state that lies about the layout.
 */
export function DataTableSkeletonRows<T>({ columns, rowCount }: DataTableSkeletonRowsProps<T>) {
  return (
    <>
      {Array.from({ length: rowCount }, (_, rowIndex) => (
        <tr key={rowIndex} className="h-row">
          {columns.map((column) => (
            <td
              key={column.id}
              className={cn(
                'px-4',
                COLUMN_WIDTH_CLASS[column.width ?? 'fill'],
                columnPriorityClass(column),
              )}
            >
              {column.kind === 'identity' ? (
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ) : column.kind === 'status' || column.kind === 'badge' ? (
                <Skeleton className="h-5 w-16" />
              ) : column.kind === 'actions' ? (
                <Skeleton className="ml-auto h-5 w-12" />
              ) : (
                <Skeleton className="h-3.5 w-full" />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
