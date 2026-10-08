import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const WIDTH = {
  /** Admin list pages. */
  page: 'max-w-page',
  /** A single form, centred. */
  form: 'max-w-form',
  /** Edge to edge, for a page that manages its own columns. */
  full: 'max-w-none',
} as const;

export interface PageShellProps {
  children: ReactNode;
  width?: keyof typeof WIDTH;
  /** Centre the content vertically — for a loader, an error or an auth screen. */
  isCentered?: boolean;
  className?: string | undefined;
}

/**
 * The page frame: background, outer padding, content width. Repeated by hand in
 * every page before this existed, which is how three pages ended up with three
 * different maximum widths.
 *
 * It fills its slot rather than claiming the viewport: inside the app shell the
 * header already takes part of the screen, and a `min-h-screen` page under it
 * puts a scrollbar on every page that has nothing to scroll.
 */
export function PageShell({
  children,
  width = 'page',
  isCentered = false,
  className,
}: PageShellProps) {
  return (
    <div
      className={cn(
        'bg-background min-h-full p-6',
        isCentered ? 'flex flex-col items-center justify-center' : '',
        className,
      )}
    >
      <div className={cn('mx-auto w-full space-y-4', WIDTH[width])}>{children}</div>
    </div>
  );
}
