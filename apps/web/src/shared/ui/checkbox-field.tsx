import { type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { FieldError } from './field-error';
import { FOCUS_RING } from './focus-ring';

export interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: string | undefined;
  label: ReactNode;
}

export function CheckboxField({ id, label, error, className, ...props }: CheckboxFieldProps) {
  const hasError = error !== undefined && error !== '';

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          className={cn(
            'border-border text-primary rounded-inner size-4 cursor-pointer',
            FOCUS_RING,
            className,
          )}
          {...props}
        />
        <label htmlFor={id} className="text-muted-foreground text-label cursor-pointer select-none">
          {label}
        </label>
      </div>
      {hasError ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
