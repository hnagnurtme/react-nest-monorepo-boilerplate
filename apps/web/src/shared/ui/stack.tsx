import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const GAP = {
  /** Inside one group: a label and its control. */
  tight: 'gap-1.5',
  /** Between sibling elements: buttons in a row, badges in a cell. */
  snug: 'gap-2',
  /** Between blocks in a page section. */
  normal: 'gap-4',
  /** Between page-level sections. */
  loose: 'gap-6',
} as const;

export interface StackProps {
  children: ReactNode;
  direction?: 'row' | 'column';
  gap?: keyof typeof GAP;
  /** Wrap onto the next line instead of overflowing — the default for rows. */
  isWrapping?: boolean;
  className?: string | undefined;
}

/**
 * Spacing with four named steps instead of whichever number was closest to hand.
 * Keeps the gap scale in rule 11 section B1 enforceable by reading the markup.
 */
export function Stack({
  children,
  direction = 'column',
  gap = 'normal',
  isWrapping = true,
  className,
}: StackProps) {
  return (
    <div
      className={cn(
        'flex',
        direction === 'row' ? 'flex-row items-center' : 'flex-col',
        direction === 'row' && isWrapping ? 'flex-wrap' : '',
        GAP[gap],
        className,
      )}
    >
      {children}
    </div>
  );
}
