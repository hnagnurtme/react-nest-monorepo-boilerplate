import { type SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string | undefined;
  error?: string | undefined;
  options: readonly SelectOption[];
  /** Rendered as a disabled-looking first entry with an empty value. */
  placeholder?: string | undefined;
}

export function Select({
  id,
  label,
  error,
  options,
  placeholder,
  className,
  ...props
}: SelectProps) {
  return (
    <div className="w-full space-y-1.5">
      {label === undefined ? null : (
        <label htmlFor={id} className="text-foreground block text-xs font-semibold">
          {label}
        </label>
      )}
      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error !== undefined && id !== undefined ? `${id}-error` : undefined}
        className={cn(
          'bg-card text-foreground w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors',
          'focus:border-primary focus:ring-primary/20 focus:ring-2',
          error === undefined ? 'border-border' : 'border-destructive',
          className,
        )}
        {...props}
      >
        {placeholder === undefined ? null : <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error === undefined ? null : (
        <p
          id={id === undefined ? undefined : `${id}-error`}
          role="alert"
          className="text-destructive text-xs"
        >
          {error}
        </p>
      )}
    </div>
  );
}
