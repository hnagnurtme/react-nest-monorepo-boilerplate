import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/**
 * Every tone carries a border, not only the status ones: a bordered success chip
 * next to a borderless neutral chip reads as two different components.
 */
const TONE_STYLES = {
  neutral: 'bg-muted text-muted-foreground border-border',
  primary: 'bg-primary-light text-primary border-primary/25',
  success: 'bg-success-light text-success border-success-border',
  warning: 'bg-warning-light text-warning border-warning-border',
  danger: 'bg-destructive-light text-destructive border-destructive-border',
  info: 'bg-info-light text-info border-info-border',
} as const;

export type BadgeTone = keyof typeof TONE_STYLES;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'text-caption rounded-inner inline-flex h-5 items-center whitespace-nowrap border px-2',
        TONE_STYLES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
