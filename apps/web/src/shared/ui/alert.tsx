import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const TONE_STYLES = {
  danger: 'bg-destructive-light border-destructive-border text-destructive',
  warning: 'bg-warning-light border-warning-border text-warning',
  success: 'bg-success-light border-success-border text-success',
  info: 'bg-primary-light border-primary/20 text-primary',
} as const;

const TONE_ICONS = {
  danger: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
} as const;

export type AlertTone = keyof typeof TONE_STYLES;

export interface AlertProps {
  tone?: AlertTone;
  children: ReactNode;
  className?: string | undefined;
}

/**
 * An inline message about the block it sits in — a failed submit, a permission
 * refusal. Carries an icon as well as a colour, so the meaning survives for a
 * reader who cannot tell the two tones apart (rule 11, section G2).
 *
 * `role="alert"` for the tones that report a problem; a success note does not
 * interrupt a screen reader mid-sentence.
 */
export function Alert({ tone = 'danger', children, className }: AlertProps) {
  const ToneIcon = TONE_ICONS[tone];
  const isProblem = tone === 'danger' || tone === 'warning';

  return (
    <div
      role={isProblem ? 'alert' : 'status'}
      className={cn(
        'text-body rounded-inner flex items-start gap-2 border p-3',
        TONE_STYLES[tone],
        className,
      )}
    >
      <ToneIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
