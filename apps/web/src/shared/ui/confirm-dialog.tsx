import { AlertTriangle } from 'lucide-react';

import { Button } from './button';
import { Dialog } from './dialog';

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel: string;
  /** `danger` for destructive confirmations (delete, deactivate). */
  tone?: 'danger' | 'default';
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Replaces `window.confirm`, which cannot be styled, translated per layout or
 * tested without stubbing a global, and blocks the whole page while open.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  closeLabel,
  tone = 'danger',
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      title={title}
      closeLabel={closeLabel}
      onClose={onCancel}
      width="sm"
      closeOnOverlayClick={!isPending}
      footer={
        <>
          <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'destructive' : 'primary'}
            isLoading={isPending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {tone === 'danger' ? (
          <span className="bg-destructive-light text-destructive rounded-inner flex size-10 shrink-0 items-center justify-center">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
        ) : null}
        <p className="text-muted-foreground text-body leading-relaxed">{message}</p>
      </div>
    </Dialog>
  );
}
