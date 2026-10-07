import { type HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

const TONE_STYLES = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-light text-primary',
  success: 'bg-success-light text-success border border-success-border',
  warning: 'bg-warning-light text-warning border border-warning-border',
  danger: 'bg-destructive-light text-destructive border border-destructive-border',
} as const;

export type BadgeTone = keyof typeof TONE_STYLES;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        TONE_STYLES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
