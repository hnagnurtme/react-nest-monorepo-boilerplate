import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

export interface DialogProps {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

/** Minimal modal dialog: overlay, Escape to close, labelled for assistive tech. */
export function Dialog({ title, closeLabel, onClose, children }: DialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="border-border bg-card max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border p-6 shadow-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-foreground text-lg font-bold">{title}</h2>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
