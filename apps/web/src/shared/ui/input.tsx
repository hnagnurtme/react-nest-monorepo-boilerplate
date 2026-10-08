import { type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { CONTROL_HEIGHT, CONTROL_PADDING, CONTROL_TEXT, type ControlSize } from './control';
import { FIELD_BASE, fieldBorder, fieldErrorId } from './field';
import { FieldError } from './field-error';
import { Label } from './label';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  error?: string | undefined;
  label?: string | undefined;
  size?: ControlSize | undefined;
  /** Decorative leading icon; the input's padding makes room for it. */
  startIcon?: ReactNode;
  /** A trailing control such as clear or reveal. Pass an `IconButton`. */
  endAction?: ReactNode;
}

/**
 * Adornments are slots rather than something each page positions itself: a search
 * icon absolutely placed at the call site has to re-derive the input's padding,
 * and it drifts the moment the control height changes.
 */
export function Input({
  id,
  label,
  error,
  size = 'md',
  startIcon,
  endAction,
  className,
  ...props
}: InputProps) {
  const hasError = error !== undefined && error !== '';

  return (
    <div className="w-full space-y-1.5">
      {label === undefined ? null : <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        {startIcon === undefined ? null : (
          <span
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5"
          >
            {startIcon}
          </span>
        )}
        <input
          id={id}
          aria-invalid={hasError}
          aria-describedby={fieldErrorId(id, hasError)}
          className={cn(
            FIELD_BASE,
            fieldBorder(hasError),
            CONTROL_HEIGHT[size],
            CONTROL_PADDING[size],
            CONTROL_TEXT[size],
            startIcon === undefined ? '' : 'pl-10',
            endAction === undefined ? '' : 'pr-11',
            className,
          )}
          {...props}
        />
        {endAction === undefined ? null : (
          <span className="absolute inset-y-0 right-0 flex items-center pr-1">{endAction}</span>
        )}
      </div>
      {hasError ? <FieldError id={fieldErrorId(id, true)}>{error}</FieldError> : null}
    </div>
  );
}
