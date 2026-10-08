import { AlertTriangle } from 'lucide-react';
import { type ReactNode } from 'react';

import { Card } from './card';

export interface ErrorStateProps {
  title: string;
  description?: string;
  /** A retry button. An error with no way forward leaves the user stuck. */
  action?: ReactNode;
}

/**
 * A failed request, shown in place of the content it replaces. `role="alert"` so
 * the failure is announced rather than silently swapped in.
 */
export function ErrorState({ title, description, action }: ErrorStateProps) {
  return (
    <Card
      role="alert"
      className="border-destructive-border bg-destructive-light flex flex-col items-center gap-3 p-8 text-center"
    >
      <AlertTriangle className="text-destructive size-8" aria-hidden="true" />
      <p className="text-foreground text-heading font-semibold">{title}</p>
      {description === undefined ? null : (
        <p className="text-muted-foreground text-body max-w-form">{description}</p>
      )}
      {action === undefined ? null : <div className="pt-1">{action}</div>}
    </Card>
  );
}
