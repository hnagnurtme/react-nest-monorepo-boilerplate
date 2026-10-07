import { type InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string | undefined;
  label?: string | undefined;
}

export function Input({ id, label, error, className, ...props }: InputProps) {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-foreground block text-xs font-semibold">
          {label}
        </label>
      )}
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error && id ? `${id}-error` : undefined}
        className={cn(
          'bg-card w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors',
          'focus:border-primary focus:ring-primary/20 focus:ring-2',
          error ? 'border-destructive' : 'border-border',
          className,
        )}
        {...props}
      />
      {error && (
        <p id={id ? `${id}-error` : undefined} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
