import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/**
 * One definition for the whole matrix: cva builds the class string once at
 * module load and resolves the defaults, so a caller cannot forget a variant.
 * Padding grows monotonically with the size; `xs` used to be taller than `sm`.
 */
export const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-md hover:bg-primary-hover active:bg-primary-active',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-border bg-card text-foreground hover:bg-muted',
        ghost: 'text-foreground hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
      },
      size: {
        xs: 'px-2.5 py-1 text-xs',
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2.5 text-sm',
        lg: 'px-6 py-3 text-base',
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
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
