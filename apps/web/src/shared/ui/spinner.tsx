import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

const SPINNER_SIZE = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-8',
} as const;

export interface SpinnerProps {
  size?: keyof typeof SPINNER_SIZE;
  className?: string | undefined;
  /** Set when the spinner is the only thing announcing the wait. */
  label?: string | undefined;
}

/**
 * The one busy indicator. Decorative by default — a spinner inside a Button that
 * already carries `aria-busy` must not announce itself a second time.
 */
export function Spinner({ size = 'md', className, label }: SpinnerProps) {
  return (
    <Loader2
      className={cn('animate-spin', SPINNER_SIZE[size], className)}
      role={label === undefined ? undefined : 'status'}
      aria-label={label}
      aria-hidden={label === undefined ? 'true' : undefined}
    />
  );
}
