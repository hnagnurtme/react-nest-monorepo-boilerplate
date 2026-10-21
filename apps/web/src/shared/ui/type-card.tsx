import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { buttonVariants } from './button';

export interface TypeCardProps {
  /** A lucide icon, already sized — or any small visual, such as a thumbnail. */
  icon: ReactNode;
  title: string;
  description?: string | undefined;
  isSelected: boolean;
  onSelect: () => void;
  isDisabled?: boolean | undefined;
  /**
   * `stacked` puts the icon on the title's line, above the description, which
   * suits a grid of kinds. `inline` puts it in a column of its own beside both
   * lines, which suits a list where the visual is the thing being recognised.
   * `tile` is a 4:3 card with a large visual above the two lines, for a grid
   * where the picture carries the recognition — a tenant's logo, a cover.
   */
  layout?: 'stacked' | 'inline' | 'tile' | undefined;
  /**
   * The large visual for `tile`, filling the top of the card. Falls back to
   * `icon` when there is no picture to show.
   */
  media?: ReactNode;
  /** Pinned to the trailing edge: a tick, a count, a chevron. */
  trailing?: ReactNode;
  className?: string | undefined;
}

/**
 * One choice in a picker of kinds — an item type, a step kind, a tenant. A
 * button with `aria-pressed`, not a radio: the set is browsed rather than
 * answered, and the description is part of the choice.
 *
 * It takes `buttonVariants` and then relaxes the height and the nowrap, because
 * the control scale is a scale of *control* heights and a card holding two lines
 * of text is not a control. That override lives here, once, rather than at every
 * call site.
 */
export function TypeCard({
  icon,
  title,
  description,
  isSelected,
  onSelect,
  isDisabled = false,
  layout = 'stacked',
  media,
  trailing,
  className,
}: TypeCardProps) {
  const isInline = layout === 'inline';

  if (layout === 'tile') {
    return (
      <button
        type="button"
        aria-pressed={isSelected}
        disabled={isDisabled}
        onClick={onSelect}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'rounded-surface aspect-[4/3] h-auto w-full flex-col items-stretch gap-0 overflow-hidden whitespace-normal p-0 text-left font-normal',
          isSelected ? 'border-border-strong ring-ring ring-2' : '',
          className,
        )}
      >
        <span className="bg-sunken text-muted-foreground flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          {media ?? icon}
        </span>

        <span className="flex items-center gap-2 px-3 py-2">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-label truncate font-semibold">{title}</span>
            {description === undefined ? null : (
              <span className="text-caption text-muted-foreground truncate font-normal normal-case">
                {description}
              </span>
            )}
          </span>
          {trailing === undefined ? null : <span className="shrink-0">{trailing}</span>}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      disabled={isDisabled}
      onClick={onSelect}
      className={cn(
        buttonVariants({ variant: 'outline' }),
        'rounded-surface h-auto w-full gap-1 whitespace-normal p-3 text-left font-normal',
        isInline ? 'flex items-center gap-3' : 'flex-col items-start',
        isSelected ? 'bg-selected border-border-strong' : '',
        className,
      )}
    >
      {isInline ? <span className="text-muted-foreground inline-flex shrink-0">{icon}</span> : null}

      <span className={cn('flex flex-col gap-1', isInline ? 'min-w-0 flex-1' : 'items-start')}>
        <span
          className={cn('text-label flex items-center gap-2 font-semibold', isInline && 'truncate')}
        >
          {isInline ? null : <span className="text-muted-foreground inline-flex">{icon}</span>}
          {title}
        </span>
        {description === undefined ? null : (
          <span
            className={cn(
              'text-caption text-muted-foreground font-normal normal-case',
              isInline && 'truncate',
            )}
          >
            {description}
          </span>
        )}
      </span>

      {trailing === undefined ? null : <span className="shrink-0">{trailing}</span>}
    </button>
  );
}
