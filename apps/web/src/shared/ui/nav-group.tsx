import { ChevronDown } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { NAV_ROW_BASE, NAV_ROW_TONE, navRowLayout } from './nav-row';

export interface NavGroupProps {
  label: string;
  icon: ReactNode;
  /** True while the group's items are shown. */
  isOpen: boolean;
  onToggle: () => void;
  /** True while a descendant is the current page, so a closed group still reads as current. */
  hasActiveChild?: boolean;
  /** Rail mode: the icon alone, and toggling is what reopens the sidebar. */
  isIconOnly?: boolean;
  children: ReactNode;
}

/**
 * A sidebar section that opens to reveal its items.
 *
 * The open state is owned by the sidebar, not here: it has to survive a reload
 * and has to open itself when the URL points inside the group, and neither is
 * knowable from within one group.
 */
export function NavGroup({
  label,
  icon,
  isOpen,
  onToggle,
  hasActiveChild = false,
  isIconOnly = false,
  children,
}: NavGroupProps) {
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={isIconOnly ? label : undefined}
        title={isIconOnly ? label : undefined}
        className={cn(
          NAV_ROW_BASE,
          'w-full cursor-pointer',
          navRowLayout(isIconOnly),
          hasActiveChild
            ? isOpen
              ? NAV_ROW_TONE['current-open']
              : NAV_ROW_TONE.current
            : NAV_ROW_TONE.idle,
        )}
      >
        <span className="shrink-0">{icon}</span>
        {isIconOnly ? null : (
          <>
            <span className="flex-1 truncate text-left">{label}</span>
            <ChevronDown
              aria-hidden="true"
              className={cn('size-4 shrink-0 transition-transform', isOpen ? '' : '-rotate-90')}
            />
          </>
        )}
      </button>

      {/*
        Kept in the tree while closed would let a collapsed group's links take
        Tab focus, so it is removed instead of hidden.
      */}
      {isOpen && !isIconOnly ? (
        <ul id={panelId} className="mt-1 space-y-1 pl-4">
          {children}
        </ul>
      ) : null}
    </div>
  );
}
