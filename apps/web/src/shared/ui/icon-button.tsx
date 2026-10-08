import { cva, type VariantProps } from 'class-variance-authority';
import { type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { FOCUS_RING } from './focus-ring';

/**
 * A square button whose whole label is its icon. Separate from `Button` because
 * the constraints differ: the hit area must stay square and at least 2rem, and
 * the accessible name can only come from `label` — there is no text child to
 * fall back on.
 */
const iconButtonVariants = cva(
  cn(
    'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-control transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50',
    FOCUS_RING,
  ),
  {
    variants: {
      variant: {
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        outline: 'border-border bg-card text-muted-foreground hover:text-foreground border',
        subtle: 'bg-muted text-muted-foreground hover:text-foreground',
      },
      size: {
        sm: 'size-8',
        md: 'size-10',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
);

export interface IconButtonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>,
    VariantProps<typeof iconButtonVariants> {
  /** The accessible name. Required: an icon alone announces nothing. */
  label: string;
  icon: ReactNode;
}

export function IconButton({
  type = 'button',
  label,
  icon,
  variant,
  size,
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      {icon}
    </button>
  );
}
