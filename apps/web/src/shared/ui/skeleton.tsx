import { cn } from '@/lib/utils';

export interface SkeletonProps {
  className?: string | undefined;
}

/**
 * A placeholder that occupies the space the real content will take, so the page
 * does not jump when the request lands. Hidden from assistive tech: the live
 * region announcing the wait belongs to the container, not to each grey box.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div aria-hidden="true" className={cn('bg-muted rounded-inner animate-pulse', className)} />
  );
}

export interface SkeletonTableProps {
  rows?: number;
  columns: number;
  /** Announced while the rows are loading. */
  label: string;
}

/** The loading shape of a `DataTable`: same row height, same column count. */
export function SkeletonTable({ rows = 5, columns, label }: SkeletonTableProps) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-3">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
