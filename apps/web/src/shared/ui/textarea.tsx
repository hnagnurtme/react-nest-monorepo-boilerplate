import { type TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

import { FIELD_BASE, fieldBorder, fieldErrorId } from './field';
import { FieldError } from './field-error';
import { Label } from './label';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string | undefined;
  label?: string | undefined;
  /** Shows the asterisk on the label and sets `aria-required`. */
  isRequired?: boolean | undefined;
}

/** Multi-line text, same shell as Input so the two never drift apart visually. */
export function Textarea({
  id,
  label,
  error,
  isRequired = false,
  rows = 4,
  className,
  ...props
}: TextareaProps) {
  const hasError = error !== undefined && error !== '';

  return (
    <div className="w-full space-y-1.5">
      {label === undefined ? null : (
        <Label htmlFor={id} isRequired={isRequired}>
          {label}
        </Label>
      )}
      <textarea
        id={id}
        rows={rows}
        aria-required={isRequired}
        aria-invalid={hasError}
        aria-describedby={fieldErrorId(id, hasError)}
        className={cn(
          FIELD_BASE,
          fieldBorder(hasError),
          'text-body resize-y px-3.5 py-2.5',
          className,
        )}
        {...props}
      />
      {hasError ? <FieldError id={fieldErrorId(id, true)}>{error}</FieldError> : null}
    </div>
  );
}
