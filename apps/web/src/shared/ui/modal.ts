import { useEffect, type RefObject } from 'react';

/**
 * Modal plumbing shared by every overlay that takes the page over: the focus
 * trap, the Escape key and the scroll lock. It lives apart from `Dialog` so a
 * side panel behaves exactly like a centred dialog instead of almost like one —
 * a second copy of this logic is how two overlays drift apart.
 */

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Nested overlays (a confirm inside an editor) each lock the page, so the lock is
 * reference-counted: the last one to close is the one that restores scrolling.
 */
let scrollLockCount = 0;

export function lockBodyScroll(): () => void {
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

/**
 * Focus moves into the panel on open and back to the trigger on close, Escape
 * closes, Tab cycles inside, and the page behind cannot scroll. The listeners
 * live on the document so the panel stays a plain container with no handlers.
 */
export function useModalBehaviour(panelRef: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? panel)?.focus();

    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [panelRef]);

  useEffect(() => lockBodyScroll(), []);

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
  }, [onClose, panelRef]);
}
