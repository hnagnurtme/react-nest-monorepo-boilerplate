import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

import { CONTROL_HEIGHT } from './control';
import { FIELD_BASE, fieldBorder, fieldErrorId } from './field';
import { FieldError } from './field-error';
import { Label } from './label';

const DEFAULT_LENGTH = 6;
const NON_DIGIT = /\D/g;

export interface OtpInputProps {
  /** Also the id of the first box, so a label's `htmlFor` lands on it. */
  id: string;
  label?: string | undefined;
  /** Shows the asterisk on the label and sets `aria-required` on each box. */
  isRequired?: boolean | undefined;
  /** The code so far. Shorter than `length` means the rest is still blank. */
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: string | undefined;
  isDisabled?: boolean;
}

/**
 * One box per digit. A single text field would be fewer moving parts, but a
 * code read off a phone is entered digit by digit, and separate boxes show how
 * many are left without the user counting characters.
 *
 * The value stays a plain string: the boxes are a rendering of it, so paste,
 * autofill and validation all keep working on one `otp` form field.
 */
export function OtpInput({
  id,
  label,
  isRequired = false,
  value,
  onChange,
  length = DEFAULT_LENGTH,
  error,
  isDisabled = false,
}: OtpInputProps) {
  const hasError = error !== undefined && error !== '';
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const focusBox = (index: number) => {
    const target = boxes.current[Math.min(Math.max(index, 0), length - 1)];
    target?.focus();
    target?.select();
  };

  /** Writes `digits` starting at `start`, then parks the caret on the first gap. */
  const write = (start: number, digits: string) => {
    const next = value.padEnd(length, ' ').split('');
    // Array.from rather than a spread: the spread form trips no-misused-spread.
    for (const [offset, digit] of Array.from(digits).entries()) {
      if (start + offset < length) next[start + offset] = digit;
    }
    const joined = next.join('').replaceAll(' ', '').slice(0, length);
    onChange(joined);
    focusBox(start + digits.length);
  };

  const handleKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      // An empty box sends the deletion to the one before it, which is what
      // backspace does in a single field.
      const target = value[index] === undefined || value[index] === '' ? index - 1 : index;
      if (target < 0) return;
      onChange(value.slice(0, target) + value.slice(target + 1));
      focusBox(target);
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusBox(index - 1);
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (index: number) => (event: ClipboardEvent<HTMLInputElement>) => {
    const digits = event.clipboardData.getData('text').replace(NON_DIGIT, '');
    if (digits === '') return;
    event.preventDefault();
    write(index, digits.slice(0, length - index));
  };

  return (
    <div className="w-full space-y-1.5">
      {label === undefined ? null : (
        <Label htmlFor={id} isRequired={isRequired}>
          {label}
        </Label>
      )}
      <div
        role="group"
        aria-label={label}
        aria-describedby={fieldErrorId(id, hasError)}
        className="flex gap-2"
      >
        {Array.from({ length }, (_, index) => (
          <input
            // The boxes have no identity of their own: they are positions in one
            // value, so the index is the key.
            key={index}
            ref={(node) => {
              boxes.current[index] = node;
            }}
            id={index === 0 ? id : `${id}-${String(index)}`}
            type="text"
            inputMode="numeric"
            // Only the first box claims the SMS code, or the browser fills all six
            // boxes with the whole code.
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            disabled={isDisabled}
            aria-required={isRequired}
            aria-invalid={hasError}
            aria-label={`${String(index + 1)}/${String(length)}`}
            maxLength={1}
            value={value[index] ?? ''}
            onChange={(event) => {
              const digits = event.target.value.replace(NON_DIGIT, '');
              // Autofill and some keyboards deliver the whole code into one box.
              if (digits !== '') write(index, digits);
            }}
            onKeyDown={handleKeyDown(index)}
            onPaste={handlePaste(index)}
            onFocus={(event) => {
              event.target.select();
            }}
            className={cn(
              FIELD_BASE,
              fieldBorder(hasError),
              CONTROL_HEIGHT.lg,
              'text-heading min-w-0 flex-1 px-0 text-center font-semibold',
            )}
          />
        ))}
      </div>
      {hasError ? <FieldError id={fieldErrorId(id, true)}>{error}</FieldError> : null}
    </div>
  );
}
