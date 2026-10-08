import { useEffect, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Accessible name — a drawer is a landmark, not an anonymous panel. */
  label: string;
  children: ReactNode;
  className?: string | undefined;
}

/**
 * An off-canvas panel sliding in from the left, for the sidebar at phone width.
 *
 * Not built on `Dialog`: a navigation drawer must not trap focus or lock page
 * scroll — the page behind it is the thing being navigated, and the panel
 * closes the moment a link inside it is followed.
 */
export function Drawer({ isOpen, onClose, label, children, className }: DrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      {/*
        Mouse-only affordance: Escape and the toggle button cover the keyboard,
        so it stays out of the accessibility tree.
      */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="bg-overlay absolute inset-0 cursor-default"
      />
      <div
        className={cn(
          'border-border bg-card shadow-overlay w-sidebar relative z-10 flex h-full flex-col border-r',
          className,
        )}
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}
