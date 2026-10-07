import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Drop the default padding when the card wraps a table or a list. */
  isFlush?: boolean;
}

/** The one surface container: border, card background, rounded corners. */
export function Card({ isFlush = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'border-border bg-card rounded-xl border',
        isFlush ? 'overflow-hidden' : 'p-4',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
