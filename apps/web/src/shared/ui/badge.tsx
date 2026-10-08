import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

const TONE_STYLES = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-light text-primary',
  success: 'bg-success-light text-success border-success-border border',
  warning: 'bg-warning-light text-warning border-warning-border border',
  danger: 'bg-destructive-light text-destructive border-destructive-border border',
} as const;

export type BadgeTone = keyof typeof TONE_STYLES;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'text-label rounded-pill inline-flex items-center px-2 py-0.5 font-medium',
        TONE_STYLES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
