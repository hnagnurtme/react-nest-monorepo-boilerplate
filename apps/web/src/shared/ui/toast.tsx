import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useState, useCallback, useMemo, type ReactNode } from 'react';

import { ToastContext, type ToastMessage } from './use-toast';

const RADIX_BASE = 36;
const STRING_SUBSTRING_START = 2;
const STRING_SUBSTRING_END = 9;
const DEFAULT_TOAST_DURATION_MS = 5000;

function ToastItem({
  toast,
  onClose,
  closeLabel,
}: {
  toast: ToastMessage;
  onClose: (id: string) => void;
  closeLabel: string;
}) {
  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg transition-all ${
        toast.type === 'error'
          ? 'bg-destructive/10 border-destructive text-destructive'
          : toast.type === 'success'
            ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
            : 'bg-card border-border text-foreground'
      }`}
    >
      {toast.type === 'error' && <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />}
      {toast.type === 'success' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
      {toast.type === 'info' && <Info className="mt-0.5 h-5 w-5 shrink-0" />}
      <div className="flex-1 text-xs sm:text-sm">
        {toast.title && <h4 className="mb-0.5 font-semibold">{toast.title}</h4>}
        <p>{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          onClose(toast.id);
        }}
        className="text-muted-foreground hover:text-foreground cursor-pointer"
        aria-label={closeLabel}
      >
        <X className="h-4 w-4" />
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
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = Math.random()
        .toString(RADIX_BASE)
        .substring(STRING_SUBSTRING_START, STRING_SUBSTRING_END);
      const newToast: ToastMessage = { ...toast, id };
      setToasts((prev) => [...prev, newToast]);

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
        className="aria-live-polite pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={removeToast} closeLabel={closeLabel} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
