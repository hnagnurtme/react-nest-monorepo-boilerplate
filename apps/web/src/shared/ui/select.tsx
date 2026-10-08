import { type SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

import { CONTROL_HEIGHT, CONTROL_PADDING, CONTROL_TEXT, type ControlSize } from './control';
import { FIELD_BASE, fieldBorder, fieldErrorId } from './field';
import { FieldError } from './field-error';
import { Label } from './label';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string | undefined;
  error?: string | undefined;
  size?: ControlSize | undefined;
  options: readonly SelectOption[];
  /** Rendered as a disabled-looking first entry with an empty value. */
  placeholder?: string | undefined;
}

export function Select({
  id,
  label,
  error,
  size = 'md',
  options,
  placeholder,
  className,
  ...props
}: SelectProps) {
  const hasError = error !== undefined && error !== '';

  return (
    <div className="w-full space-y-1.5">
      {label === undefined ? null : <Label htmlFor={id}>{label}</Label>}
      <select
        id={id}
        aria-invalid={hasError}
        aria-describedby={fieldErrorId(id, hasError)}
        className={cn(
          FIELD_BASE,
          fieldBorder(hasError),
          CONTROL_HEIGHT[size],
          CONTROL_PADDING[size],
          CONTROL_TEXT[size],
          'cursor-pointer',
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
      {hasError ? <FieldError id={fieldErrorId(id, true)}>{error}</FieldError> : null}
    </div>
  );
}
