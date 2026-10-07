import { type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: string | undefined;
  label: ReactNode;
}

export function CheckboxField({ id, label, error, className, ...props }: CheckboxFieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          className={cn(
            'border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer rounded',
            className,
          )}
          {...props}
        />
        <label htmlFor={id} className="text-muted-foreground cursor-pointer select-none text-xs">
          {label}
        </label>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
