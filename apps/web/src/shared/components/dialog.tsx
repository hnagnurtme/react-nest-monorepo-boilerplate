import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const WIDTH_STYLES = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
} as const;

export type DialogWidth = keyof typeof WIDTH_STYLES;

/**
 * Nested dialogs (a confirm inside an editor) each lock the page, so the lock is
 * reference-counted: the last one to close is the one that restores scrolling.
 */
let scrollLockCount = 0;

function lockBodyScroll(): () => void {
  if (scrollLockCount === 0) {
    document.body.dataset['previousOverflow'] = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount += 1;

  return () => {
    scrollLockCount = Math.max(scrollLockCount - 1, 0);
    if (scrollLockCount === 0) {
      document.body.style.overflow = document.body.dataset['previousOverflow'] ?? '';
      delete document.body.dataset['previousOverflow'];
    }
  };
}

export interface DialogProps {
  title: string;
  /** Accessible name of the header close button. */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  width?: DialogWidth;
  /** Clicking the scrim closes the dialog unless a form would lose work. */
  closeOnOverlayClick?: boolean;
  /** Rendered under the body, right-aligned by the caller. */
  footer?: ReactNode;
}

/**
 * Modal dialog: labelled for assistive tech, Escape to close, focus trapped
 * inside while open and returned to the trigger afterwards, page scroll locked.
 */
export function Dialog({
  title,
  closeLabel,
  onClose,
  children,
  width = 'md',
  closeOnOverlayClick = true,
  footer,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Move focus into the dialog, and put it back where it was on close: without
  // this, keyboard focus stays on the page behind the scrim.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? panel)?.focus();

    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  useEffect(() => lockBodyScroll(), []);

  // Escape closes; Tab cycles inside the panel. Both live on the document so the
  // panel itself stays a plain `role="dialog"` container with no event handlers.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="bg-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      {closeOnOverlayClick ? (
        // Mouse-only affordance; Escape and the header button cover the keyboard,
        // so it is hidden from assistive tech to keep one "close" in the a11y tree.
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={onClose}
          className="absolute inset-0 cursor-default"
        />
      ) : null}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'border-border bg-card relative z-10 max-h-[90vh] w-full space-y-4 overflow-y-auto rounded-2xl border p-6 shadow-lg',
          WIDTH_STYLES[width],
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-foreground text-lg font-bold">
            {title}
          </h2>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded-lg p-1.5 transition-colors"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
        {footer ? <div className="flex justify-end gap-2 pt-2">{footer}</div> : null}
      </div>
    </div>
  );
}
