import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The dot carries the hue, the label carries the meaning. A filled badge would
 * put the heaviest mark in the table on the state nearly every row is in, which
 * inverts the signal: the row that needs attention is then the quiet one. Colour
 * weight follows rarity, so a steady state gets 8px of it and nothing more.
 *
 * `muted-foreground` rather than a scale step for `inactive`: a dot is a
 * meaningful graphic, so WCAG 1.4.11 wants 3:1 against the row, and base-400
 * only reaches 2.23:1 in light mode.
 */
const TONE_DOT = {
  active: 'bg-success',
  inactive: 'bg-muted-foreground',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info',
} as const;

export type StatusDotTone = keyof typeof TONE_DOT;

export interface StatusDotProps {
  tone: StatusDotTone;
  children: ReactNode;
  className?: string | undefined;
}

export function StatusDot({ tone, children, className }: StatusDotProps) {
  return (
    <span className={cn('text-body inline-flex items-center gap-2 whitespace-nowrap', className)}>
      <span className={cn('rounded-pill size-2 shrink-0', TONE_DOT[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}
