import { cn } from '@/lib/utils';

export interface DividerProps {
  className?: string | undefined;
}

/** A plain horizontal rule on the border token. Use `DividerLabel` when it has text. */
export function Divider({ className }: DividerProps) {
  return <hr className={cn('border-border border-t', className)} />;
}
