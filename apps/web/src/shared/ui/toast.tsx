import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useState, useCallback, useMemo, type ReactNode } from 'react';

import { ToastContext, type ToastMessage } from './use-toast';

const DEFAULT_TOAST_DURATION_MS = 5000;

const TONE_STYLES = {
  error: 'bg-destructive-light border-destructive text-destructive',
  success: 'bg-success-light border-success-border text-success',
  info: 'bg-card border-border text-foreground',
} as const;

const TONE_ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
} as const;

/** Monotonic ids: two toasts raised in the same tick cannot collide. */
let toastSequence = 0;

function ToastItem({
  toast,
  onClose,
  closeLabel,
}: {
  toast: ToastMessage;
  onClose: (id: string) => void;
  closeLabel: string;
}) {
  const ToneIcon = TONE_ICONS[toast.type];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg transition-all ${TONE_STYLES[toast.type]}`}
    >
      <ToneIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="flex-1 text-xs sm:text-sm">
        {toast.title && <h4 className="mb-0.5 font-semibold">{toast.title}</h4>}
        <p>{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          onClose(toast.id);
        }}
        className="cursor-pointer opacity-70 transition-opacity hover:opacity-100"
        aria-label={closeLabel}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({
  children,
  closeLabel = 'Close notification',
}: {
  children: ReactNode;
  /** Accessible name of the dismiss button; pass a translated string. */
  closeLabel?: string;
}) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      toastSequence += 1;
      const id = `toast-${String(toastSequence)}`;
      setToasts((previous) => [...previous, { ...toast, id }]);

      setTimeout(() => {
        removeToast(id);
      }, DEFAULT_TOAST_DURATION_MS);
    },
    [removeToast],
  );

  const value = useMemo(
    () => ({ toasts, showToast, removeToast }),
    [toasts, showToast, removeToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={removeToast} closeLabel={closeLabel} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
