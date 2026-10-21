import { type LabelHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
  /** Marks the field with the red asterisk. Optional fields say nothing. */
  isRequired?: boolean | undefined;
}

/**
 * The single field-label style. Always `htmlFor`-linked — see rule 11, G3.
 *
 * Requiredness is carried by the asterisk alone: a form where most fields are
 * mandatory reads better with a mark on the few that are than with "(optional)"
 * repeated down the rest. The glyph is `aria-hidden`, because the control it
 * labels carries `aria-required` for assistive tech.
 */
export function Label({ className, children, isRequired = false, ...props }: LabelProps) {
  return (
    <label className={cn('text-foreground text-label block font-semibold', className)} {...props}>
      {children}
      {isRequired ? (
        <span aria-hidden="true" className="text-destructive ml-0.5">
          *
        </span>
      ) : null}
    </label>
  );
}
