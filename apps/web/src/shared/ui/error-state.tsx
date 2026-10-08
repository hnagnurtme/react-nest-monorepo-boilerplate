import { AlertTriangle } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Card } from './card';

export interface ErrorStateProps {
  title: string;
  description?: string;
  /** A retry button. An error with no way forward leaves the user stuck. */
  action?: ReactNode;
  /**
   * Drops the card and the tinted background, for use inside a `DataTable` cell.
   * `role="alert"` stays either way: the failure must still be announced.
   */
  isInline?: boolean;
}

/**
 * A failed request, shown in place of the content it replaces. `role="alert"` so
 * the failure is announced rather than silently swapped in.
 */
export function ErrorState({ title, description, action, isInline = false }: ErrorStateProps) {
  const Container = isInline ? 'div' : Card;

  return (
    <Container
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 text-center',
        isInline ? 'py-6' : 'border-destructive-border bg-destructive-light p-8',
      )}
    >
      <AlertTriangle className="text-destructive size-8" aria-hidden="true" />
      <p className="text-foreground text-heading font-semibold">{title}</p>
      {description === undefined ? null : (
        <p className="text-muted-foreground text-body max-w-form">{description}</p>
      )}
      {action === undefined ? null : <div className="pt-1">{action}</div>}
    </Container>
  );
}
