import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';

import { CONTROL_HEIGHT, CONTROL_PADDING } from './control';
import { FOCUS_RING_INSET } from './focus-ring';

export interface NavItemProps {
  to: string;
  label: string;
  icon?: ReactNode;
  /** True while the item is the page being shown; drives `aria-current`. */
  isActive: boolean;
  /** Rail mode shows the icon alone, with the label as the accessible name. */
  isIconOnly?: boolean;
  onNavigate?: (() => void) | undefined;
}

/**
 * One navigable row in the sidebar.
 *
 * Active state is a prop rather than `NavLink`'s own `isActive`: the sidebar
 * already resolves it from the URL to decide which group to expand, and two
 * answers to "is this the current page" is one too many.
 *
 * The ring is the inset variant — an offset ring would be clipped by the
 * sidebar's own edge.
 */
export function NavItem({
  to,
  label,
  icon,
  isActive,
  isIconOnly = false,
  onNavigate,
}: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      aria-label={isIconOnly ? label : undefined}
      title={isIconOnly ? label : undefined}
      className={cn(
        'text-body rounded-control flex items-center gap-3 font-semibold transition-colors',
        CONTROL_HEIGHT.md,
        isIconOnly ? 'justify-center px-0' : CONTROL_PADDING.md,
        isActive
          ? 'bg-primary-light text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        FOCUS_RING_INSET,
      )}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {isIconOnly ? null : <span className="truncate">{label}</span>}
    </NavLink>
  );
}
