import { type ReactNode } from 'react';

import { Card } from './card';

export interface EmptyStateProps {
  /** A lucide icon at `size-8`. Decorative — the title carries the meaning. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** The one action that resolves the emptiness, such as "Invite a user". */
  action?: ReactNode;
}

/**
 * Nothing to show is a designed state, not an absence of one. An empty list with
 * no explanation reads as a broken page.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center gap-3 p-8 text-center">
      {icon === undefined ? null : <span className="text-muted-foreground">{icon}</span>}
      <p className="text-foreground text-heading font-semibold">{title}</p>
      {description === undefined ? null : (
        <p className="text-muted-foreground text-body max-w-form">{description}</p>
      )}
      {action === undefined ? null : <div className="pt-1">{action}</div>}
    </Card>
  );
}
