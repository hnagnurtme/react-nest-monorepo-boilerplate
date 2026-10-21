import { type BaseSyntheticEvent, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface PanelFormProps {
  /** Accessible name of the form — it is a landmark, not an anonymous block. */
  label: string;
  /** Takes the event so `react-hook-form`'s `handleSubmit` can cancel the native submit. */
  onSubmit: (event: BaseSyntheticEvent) => void;
  /** Cancel beside the primary action; the caller orders them. */
  actions: ReactNode;
  children: ReactNode;
  /**
   * `panel` fills a flush `SidePanel`; `card` is the standalone block on a page,
   * which draws its own surface and lays the fields out in two columns.
   */
  variant?: PanelFormVariant;
  /**
   * Left of the actions: a hint, a dirty marker, or a destructive action that
   * must not sit next to the primary one.
   */
  leading?: ReactNode;
  className?: string | undefined;
}

export type PanelFormVariant = 'card' | 'panel';

/**
 * The form shell every create and edit surface uses: fields that scroll, and an
 * action row that does not.
 *
 * A long field list — a role checklist, say — pushes Save below the fold, and a
 * Save below the fold is a Save nobody presses. Keeping the row outside the
 * scroll area rather than `sticky` inside it also means it never overlaps the
 * last field, so nothing is typed behind it.
 */
export function PanelForm({
  label,
  onSubmit,
  actions,
  children,
  variant = 'panel',
  leading,
  className,
}: PanelFormProps) {
  const isPanel = variant === 'panel';

  return (
    <form
      aria-label={label}
      onSubmit={onSubmit}
      noValidate
      className={cn(
        'flex min-h-0 flex-col',
        isPanel ? 'h-full' : 'border-border bg-card rounded-surface border',
        className,
      )}
    >
      <div
        className={cn(
          'grid min-h-0 flex-1 gap-3 p-4',
          isPanel
            ? // One column: the panel is narrower than the page, and a
              // two-column form there puts half of every label on its own line.
              'content-start overflow-y-auto'
            : 'sm:grid-cols-2',
        )}
      >
        {children}
      </div>

      <div className="border-border bg-card flex shrink-0 flex-wrap items-center justify-between gap-3 border-t p-4">
        <div className="text-muted-foreground text-label min-w-0">{leading}</div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </form>
  );
}
