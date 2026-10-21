/**
 * The colours of one sidebar row, shared by `NavItem` and `NavGroup`.
 *
 * They drifted while each owned its own strings: a section header was
 * `text-foreground` beside items that were `text-muted-foreground`, so a closed
 * group read as louder than the page you were actually on, and a group holding
 * the current page marked it with a colour change while a leaf marked it with a
 * tinted pill. One row type, one set of states, one place to change them.
 */
import { cn } from '@/lib/utils';

import { CONTROL_HEIGHT, CONTROL_PADDING } from './control';
import { FOCUS_RING_INSET } from './focus-ring';

/** Shape, rhythm and focus treatment — everything but the colour. */
export const NAV_ROW_BASE = cn(
  'text-body rounded-control flex items-center gap-3 font-semibold transition-colors',
  CONTROL_HEIGHT.md,
  FOCUS_RING_INSET,
);

/** Rail mode centres the icon; otherwise the row keeps the control padding. */
export function navRowLayout(isIconOnly: boolean): string {
  return isIconOnly ? 'justify-center px-0' : CONTROL_PADDING.md;
}

export type NavRowTone =
  /** The page being shown, or a closed group that holds it. */
  | 'current'
  /** An open group that holds the current page: its child carries the pill. */
  | 'current-open'
  | 'idle';

export const NAV_ROW_TONE: Record<NavRowTone, string> = {
  current: 'bg-primary-light text-primary',
  'current-open': 'text-primary hover:bg-muted',
  idle: 'text-muted-foreground hover:bg-muted hover:text-foreground',
};
