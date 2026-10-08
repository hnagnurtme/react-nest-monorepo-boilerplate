import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Card } from './card';

export interface EmptyStateProps {
  /** A lucide icon at `size-8`. Decorative — the title carries the meaning. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** The one action that resolves the emptiness, such as "Invite a user". */
  action?: ReactNode;
  /**
   * Drops the card, for use inside one — a `DataTable` renders its empty state
   * in a cell of its own table, and a card nested in a card reads as a mistake.
   */
  isInline?: boolean;
}

/**
 * Nothing to show is a designed state, not an absence of one. An empty list with
 * no explanation reads as a broken page.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  isInline = false,
}: EmptyStateProps) {
  const Container = isInline ? 'div' : Card;

  return (
    <Container
      className={cn('flex flex-col items-center gap-3 text-center', isInline ? 'py-6' : 'p-8')}
    >
      {icon === undefined ? null : <span className="text-muted-foreground">{icon}</span>}
      <p className="text-foreground text-heading font-semibold">{title}</p>
      {description === undefined ? null : (
        <p className="text-muted-foreground text-body max-w-form">{description}</p>
      )}
      {action === undefined ? null : <div className="pt-1">{action}</div>}
    </Container>
  );
}
