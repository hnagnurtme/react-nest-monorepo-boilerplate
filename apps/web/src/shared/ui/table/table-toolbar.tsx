import { RotateCw, Search, X } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { IconButton } from '@/shared/ui/icon-button';
import { Input } from '@/shared/ui/input';

export interface TableToolbarProps {
  /** Omit both to render the toolbar without a search box. */
  searchValue?: string;
  onSearchChange?: ((value: string) => void) | undefined;
  searchLabel?: string;
  searchPlaceholder?: string;
  clearSearchLabel?: string;
  /**
   * Up to four always-visible filters. Anything beyond that belongs behind a
   * "More filters" popover at the call site: a toolbar that wraps to three rows
   * pushes the first row of data below the fold.
   */
  filters?: ReactNode;
  /** Slot for `ColumnVisibilityMenu`. */
  columnsControl?: ReactNode;
  onReload?: (() => void) | undefined;
  reloadLabel?: string;
  isReloading?: boolean;
  /** Slot for the page's primary action when it belongs to the table. */
  actions?: ReactNode;
}

/**
 * The strip above a list: search, filters, column control, reload. It sits
 * inside the table's card, above the header row, so filtering reads as part of
 * the table rather than as page furniture floating above it.
 *
 * Debouncing is the caller's job via `use-debounced-search-param`: the toolbar
 * holding its own timer means two sources of truth for the same string, and the
 * URL — which is the one that survives a reload — loses.
 */
export function TableToolbar({
  searchValue,
  onSearchChange,
  searchLabel = 'Search',
  searchPlaceholder,
  clearSearchLabel = 'Clear search',
  filters,
  columnsControl,
  onReload,
  reloadLabel = 'Reload',
  isReloading = false,
  actions,
}: TableToolbarProps) {
  return (
    <div className="border-border flex flex-wrap items-center gap-2 border-b p-3 sm:flex-nowrap">
      {onSearchChange === undefined ? null : (
        // `Input` renders a `w-full` wrapper of its own, which as a direct flex
        // child would claim the whole row and push the controls to a second one.
        // The box is sized here instead; `min-w-0` lets it shrink below its
        // content so nothing wraps.
        <div className="min-w-0 flex-1 sm:max-w-64">
          <Input
            aria-label={searchLabel}
            size="sm"
            value={searchValue ?? ''}
            placeholder={searchPlaceholder}
            onChange={(event) => {
              onSearchChange(event.target.value);
            }}
            startIcon={<Search aria-hidden="true" className="size-4" />}
            endAction={
              searchValue === undefined || searchValue === '' ? undefined : (
                <IconButton
                  size="sm"
                  label={clearSearchLabel}
                  icon={<X aria-hidden="true" className="size-4" />}
                  onClick={() => {
                    onSearchChange('');
                  }}
                />
              )
            }
          />
        </div>
      )}
      {filters}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {columnsControl}
        {onReload === undefined ? null : (
          <IconButton
            size="sm"
            variant="outline"
            label={reloadLabel}
            onClick={onReload}
            icon={
              <RotateCw
                aria-hidden="true"
                className={cn('size-4', isReloading && 'animate-spin')}
              />
            }
          />
        )}
        {actions}
      </div>
    </div>
  );
}
