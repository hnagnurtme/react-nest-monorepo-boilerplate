import { cn } from '@/lib/utils';

export interface FieldErrorProps {
  /** `${inputId}-error`, so the control can point at it with aria-describedby. */
  id?: string | undefined;
  children: string;
  className?: string | undefined;
}

/**
 * A field's validation message. `role="alert"` so the message reaches assistive
 * tech when it appears after a failed submit, not only when focus moves to it.
 */
export function FieldError({ id, children, className }: FieldErrorProps) {
  return (
    <p id={id} role="alert" className={cn('text-destructive text-label', className)}>
      {children}
    </p>
  );
}
