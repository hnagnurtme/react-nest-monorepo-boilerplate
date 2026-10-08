import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/shared/ui/button';
import { FOCUS_RING_INSET } from '@/shared/ui/focus-ring';

export interface FilterChip {
  key: string;
  /** Pre-translated and already including the value, e.g. "Role: Admin". */
  label: string;
  removeLabel: string;
  onRemove: () => void;
}

export interface FilterChipsProps {
  chips: readonly FilterChip[];
  clearAllLabel: string;
  onClearAll: () => void;
}

/**
 * Which filters are on, and one click to turn each off. Without this strip a
 * narrowed list is indistinguishable from an empty one — the user sees three
 * rows, not the four filters that hid the rest.
 *
 * Renders nothing when no filter is active, so the call site does not have to
 * guard it.
 */
export function FilterChips({ chips, clearAllLabel, onClearAll }: FilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="border-border flex flex-wrap items-center gap-2 border-b px-3 py-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="bg-muted text-foreground-secondary text-caption rounded-inner border-border inline-flex h-6 items-center gap-1 border pl-2.5 pr-1"
        >
          {chip.label}
          <button
            type="button"
            aria-label={chip.removeLabel}
            onClick={chip.onRemove}
            className={cn(
              'hover:bg-sunken hover:text-foreground rounded-inner cursor-pointer p-0.5 transition-colors',
              FOCUS_RING_INSET,
            )}
          >
            <X aria-hidden="true" className="size-3" />
          </button>
        </span>
      ))}
      <Button variant="ghost" size="sm" onClick={onClearAll}>
        {clearAllLabel}
      </Button>
    </div>
  );
}
