import { type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { TEXT_LINK } from './link';

export interface LinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** `label` matches the body text around it; `small` sits beside a field label. */
  size?: 'label' | 'small';
}

/**
 * An action that reads as a link inside a sentence or beside a field label —
 * "Forgot password?", "Resend the code". It is a `<button>` because it performs
 * an action rather than navigating, and it skips the control height scale on
 * purpose: a text link must sit on the same baseline as the text around it.
 */
export function LinkButton({
  type = 'button',
  size = 'label',
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        TEXT_LINK,
        'cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'small' ? 'text-label' : '',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
