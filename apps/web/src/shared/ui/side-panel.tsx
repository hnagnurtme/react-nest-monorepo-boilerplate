import { X } from 'lucide-react';
import { useId, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { IconButton } from './icon-button';
import { useModalBehaviour } from './modal';

const WIDTH_STYLES = {
  md: 'sm:max-w-panel',
  lg: 'sm:max-w-panel-lg',
} as const;

export type SidePanelWidth = keyof typeof WIDTH_STYLES;

export interface SidePanelProps {
  title: string;
  /** Accessible name of the header close button. */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  /** One line under the title: what the form does, not how to fill it in. */
  description?: string;
  width?: SidePanelWidth;
  /**
   * The body stops scrolling and loses its padding, so a child can own both —
   * a form that keeps its own action bar pinned under a scrolling field list.
   */
  isFlush?: boolean;
  /** Clicking the scrim closes the panel unless a form would lose work. */
  closeOnOverlayClick?: boolean;
  /** Pinned to the bottom of the panel, visible however long the body scrolls. */
  footer?: ReactNode;
}

/**
 * A modal panel docked to the right edge, for a create or edit form that
 * belongs beside the list it changes rather than above it.
 *
 * Same behaviour as `Dialog` — labelled, Escape to close, focus trapped, scroll
 * locked — and chosen over it when the row context matters: the table stays
 * where it was instead of being pushed down the page by a form that appeared on
 * top of it. The header and footer sit outside the scroll area, so a long form
 * never scrolls its own Save button off screen.
 */
export function SidePanel({
  title,
  closeLabel,
  onClose,
  children,
  description,
  width = 'md',
  isFlush = false,
  closeOnOverlayClick = true,
  footer,
}: SidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useModalBehaviour(panelRef, onClose);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {closeOnOverlayClick ? (
        // Mouse-only affordance; Escape and the header button cover the keyboard,
        // so it is hidden from assistive tech to keep one "close" in the a11y tree.
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={onClose}
          className="bg-overlay animate-scrim-in absolute inset-0 cursor-default"
        />
      ) : (
        <div aria-hidden="true" className="bg-overlay animate-scrim-in absolute inset-0" />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        {...(description === undefined ? {} : { 'aria-describedby': descriptionId })}
        tabIndex={-1}
        className={cn(
          'border-border bg-card shadow-overlay animate-panel-in relative z-10 flex h-full w-full flex-col border-l',
          WIDTH_STYLES[width],
        )}
      >
        <div className="border-border flex items-start justify-between gap-4 border-b p-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-foreground text-heading font-bold">
              {title}
            </h2>
            {description === undefined ? null : (
              <p id={descriptionId} className="text-muted-foreground text-label mt-1">
                {description}
              </p>
            )}
          </div>
          <IconButton
            size="sm"
            label={closeLabel}
            onClick={onClose}
            icon={<X className="size-5" aria-hidden="true" />}
          />
        </div>

        <div className={cn('min-h-0 flex-1', isFlush ? undefined : 'overflow-y-auto p-4')}>
          {children}
        </div>

        {footer ? (
          <div className="border-border flex justify-end gap-2 border-t p-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
