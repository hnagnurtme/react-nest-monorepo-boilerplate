import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, Columns3 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { CONTROL_HEIGHT } from '@/shared/ui/control';
import { FOCUS_RING_INSET } from '@/shared/ui/focus-ring';
import { IconButton } from '@/shared/ui/icon-button';

import { type ColumnVisibility } from './use-column-visibility';

export interface ColumnVisibilityMenuProps<T> extends Pick<
  ColumnVisibility<T>,
  'hideableColumns' | 'hiddenIds' | 'toggle' | 'reset'
> {
  /** Pre-translated: the trigger's accessible name, e.g. "Choose columns". */
  label: string;
  /** Pre-translated, e.g. "Show all columns". */
  resetLabel: string;
}

/**
 * A checkbox per hideable column. `preventDefault` on select keeps the menu open
 * while several columns are toggled — a menu that closes after each one turns
 * "show me these three" into three trips.
 *
 * Positioning, focus return and the Esc/outside-click behaviour come from Radix;
 * re-implementing them is how a menu ends up unreachable by keyboard.
 */
export function ColumnVisibilityMenu<T>({
  hideableColumns,
  hiddenIds,
  toggle,
  reset,
  label,
  resetLabel,
}: ColumnVisibilityMenuProps<T>) {
  const hidden = new Set(hiddenIds);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton
          size="sm"
          variant="outline"
          label={label}
          icon={<Columns3 aria-hidden="true" className="size-4" />}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="bg-card border-border rounded-surface shadow-overlay z-50 min-w-52 border p-1"
        >
          {hideableColumns.map((column) => (
            <DropdownMenu.CheckboxItem
              key={column.id}
              checked={!hidden.has(column.id)}
              onCheckedChange={() => {
                toggle(column.id);
              }}
              onSelect={(event) => {
                event.preventDefault();
              }}
              className={cn(
                'text-body text-foreground rounded-inner data-[highlighted]:bg-muted flex cursor-pointer items-center gap-2 px-2 outline-none',
                CONTROL_HEIGHT.sm,
                FOCUS_RING_INSET,
              )}
            >
              <span className="flex size-4 items-center justify-center">
                <DropdownMenu.ItemIndicator>
                  <Check aria-hidden="true" className="text-primary size-3.5" />
                </DropdownMenu.ItemIndicator>
              </span>
              {column.header}
            </DropdownMenu.CheckboxItem>
          ))}
          {hiddenIds.length === 0 ? null : (
            <>
              <DropdownMenu.Separator className="bg-border my-1 h-px" />
              <DropdownMenu.Item
                onSelect={reset}
                className={cn(
                  'text-body text-muted-foreground rounded-inner data-[highlighted]:bg-muted data-[highlighted]:text-foreground flex cursor-pointer items-center px-2 outline-none',
                  CONTROL_HEIGHT.sm,
                )}
              >
                {resetLabel}
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
