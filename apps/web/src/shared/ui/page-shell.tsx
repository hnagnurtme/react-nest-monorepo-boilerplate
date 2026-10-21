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
  /**
   * Fill the slot exactly and never scroll the page: the children own the
   * height and scroll inside themselves. For a page whose panes must all stay
   * on screen, such as a map beside a list.
   *
   * The slot, not the viewport: the app bar above is part of the screen too, so
   * `h-dvh` here cost the page exactly one header of overflow.
   */
  isFullHeight?: boolean;
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
  isFullHeight = false,
  className,
}: PageShellProps) {
  return (
    <div
      className={cn(
        /*
          Less gutter on a handset: 24px around a 390px screen spends an eighth
          of the width on nothing.
        */
        'bg-background p-4 sm:p-6',
        isFullHeight ? 'h-full overflow-hidden' : 'min-h-full',
        isCentered ? 'flex flex-col items-center justify-center' : '',
        className,
      )}
    >
      {/*
        A flex column when the page owns the height: the children then divide it
        — one of them takes `flex-1` and scrolls inside itself — which is what
        `isFullHeight` is for. `space-y-4` stays the rhythm of a normal page,
        where blocks simply follow one another.
      */}
      <div
        className={cn(
          'mx-auto w-full',
          isFullHeight ? 'flex h-full min-h-0 flex-col gap-4' : 'space-y-4',
          WIDTH[width],
        )}
      >
        {children}
      </div>
    </div>
  );
}
