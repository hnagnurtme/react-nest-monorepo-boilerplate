import { cva, type VariantProps } from 'class-variance-authority';
import { type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

import { CONTROL_HEIGHT, CONTROL_PADDING, CONTROL_TEXT } from './control';
import { FOCUS_RING } from './focus-ring';
import { Spinner } from './spinner';

/**
 * One definition for the whole matrix: cva builds the class string once at
 * module load and resolves the defaults, so a caller cannot forget a variant.
 * Height, padding and type step all come from the shared control scale, so a
 * Button lines up with an Input of the same size with nobody measuring.
 */
export const buttonVariants = cva(
  cn(
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-control font-semibold transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50',
    FOCUS_RING,
  ),
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-raised hover:bg-primary-hover active:bg-primary-active',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border-border bg-card text-foreground hover:bg-muted border',
        ghost: 'text-foreground hover:bg-muted',
        destructive:
          'border-destructive-stroke bg-destructive text-destructive-foreground hover:bg-destructive-hover border',
      },
      size: {
        sm: cn(CONTROL_HEIGHT.sm, CONTROL_PADDING.sm, CONTROL_TEXT.sm),
        md: cn(CONTROL_HEIGHT.md, CONTROL_PADDING.md, CONTROL_TEXT.md),
        lg: cn(CONTROL_HEIGHT.lg, CONTROL_PADDING.lg, CONTROL_TEXT.lg),
      },
      isFullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      isFullWidth: false,
    },
  },
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export type ButtonVariant = NonNullable<ButtonVariantProps['variant']>;
export type ButtonSize = NonNullable<ButtonVariantProps['size']>;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {
  isLoading?: boolean;
}

export function Button({
  type = 'button',
  variant,
  size,
  isFullWidth,
  isLoading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  // `||`, not `??`: an explicit `disabled={false}` must not re-enable a button
  // whose request is still in flight.
  const isDisabled = disabled === true || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      aria-disabled={isDisabled}
      className={cn(buttonVariants({ variant, size, isFullWidth }), className)}
      {...props}
    >
      {isLoading ? <Spinner size="sm" /> : null}
      {children}
    </button>
  );
}
