import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useState, useCallback, useMemo, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { IconButton } from './icon-button';
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
      className={cn(
        'rounded-surface shadow-floating pointer-events-auto flex items-start gap-3 border p-4',
        TONE_STYLES[toast.type],
      )}
    >
      <ToneIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="text-body flex-1">
        {toast.title && <h4 className="mb-0.5 font-semibold">{toast.title}</h4>}
        <p>{toast.message}</p>
      </div>
      <IconButton
        size="sm"
        label={closeLabel}
        onClick={() => {
          onClose(toast.id);
        }}
        className="-mr-1 -mt-1 shrink-0"
        icon={<X className="size-4" aria-hidden="true" />}
      />
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
