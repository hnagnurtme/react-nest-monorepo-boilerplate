import { type LabelHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
}

/** The single field-label style. Always `htmlFor`-linked — see rule 11, G3. */
export function Label({ className, children, ...props }: LabelProps) {
  return (
    <label className={cn('text-foreground text-label block font-semibold', className)} {...props}>
      {children}
    </label>
  );
}
