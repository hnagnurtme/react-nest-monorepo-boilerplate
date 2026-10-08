import { ChevronDown } from 'lucide-react';
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
    /*
     * `className` sizes the whole control, not the `<select>` inside it: the
     * chevron is positioned against this box, so a width or a `hidden` landing
     * on the inner element alone would leave the icon floating beside nothing.
     */
    <div className={cn('w-full space-y-1.5', className)}>
      {label === undefined ? null : <Label htmlFor={id}>{label}</Label>}
      {/*
        The native arrow is drawn by the platform: a different glyph per OS, in a
        colour the theme cannot reach, hard against the right edge. `appearance-none`
        removes it and the chevron below replaces it — one icon set, one colour
        token, and `pr-9` reserves room so the text cannot run underneath it.
      */}
      <div className="relative">
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
            'cursor-pointer appearance-none pr-9',
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
        <ChevronDown
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 my-auto size-4"
        />
      </div>
      {hasError ? <FieldError id={fieldErrorId(id, true)}>{error}</FieldError> : null}
    </div>
  );
}
