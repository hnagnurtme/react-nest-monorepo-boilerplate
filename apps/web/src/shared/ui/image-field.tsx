import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { formatFileSize } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/shared/hooks';

import { Button } from './button';
import { FieldError } from './field-error';
import { FileInput } from './file-input';
import { FOCUS_RING } from './focus-ring';
import { Label } from './label';

export type ImageFieldShape = 'square' | 'circle';

export interface ImageFieldProps {
  label?: string | undefined;
  /** The file the user has chosen in this session; null once cleared. */
  file: File | null;
  onChange: (file: File | null) => void;
  /** Already stored and still in force, shown until a new file replaces it. */
  currentUrl?: string | null | undefined;
  /** Media types, exactly as the upload endpoint will accept them. */
  accept: readonly string[];
  maxBytes: number;
  /** A circle for an avatar, a square for a logo or a cover. */
  shape?: ImageFieldShape | undefined;
  /** A message from outside — a rejected upload, a server-side rule. */
  error?: string | undefined;
  isDisabled?: boolean | undefined;
}

/**
 * Choosing an image: drag it in, or click through to the file picker.
 *
 * It does not upload. The file is handed to the caller, which decides when it
 * goes anywhere — for a create form that is after the record exists and can be
 * given a key, which is the whole reason this is a value and not an action.
 *
 * The preview is an object URL, not a data URL: a 2 MiB image read into base64
 * is 2.7 MiB of React state for a thumbnail.
 *
 * Type and size are checked here so every caller refuses the same files with
 * the same words. That is presentation, not policy — the server checks the
 * stored object again, because a browser is not where a limit is enforced.
 */
export function ImageField({
  label,
  file,
  onChange,
  currentUrl = null,
  accept,
  maxBytes,
  shape = 'square',
  error,
  isDisabled = false,
}: ImageFieldProps) {
  const { t } = useTranslation('common');
  const { language } = useLanguage();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);

  useEffect(() => {
    if (file === null) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  /* `image/png` reads as PNG to everyone; the full media type reads as noise. */
  const typeNames = accept.map((type) => (type.split('/')[1] ?? type).toUpperCase()).join(', ');
  const limit = formatFileSize(maxBytes, language);

  const accepts = (candidate: File): boolean => accept.includes(candidate.type);

  const take = (candidate: File | null): void => {
    if (candidate === null) {
      setIssue(null);
      onChange(null);
      return;
    }
    if (!accepts(candidate)) {
      setIssue(t('imageField.wrongType', { types: typeNames }));
      return;
    }
    if (candidate.size > maxBytes) {
      setIssue(t('imageField.tooLarge', { size: formatFileSize(candidate.size, language), limit }));
      return;
    }
    setIssue(null);
    onChange(candidate);
  };

  const openPicker = (): void => {
    inputRef.current?.click();
  };

  const clear = (): void => {
    take(null);
    // Without this, choosing the same file again fires no change event.
    if (inputRef.current !== null) inputRef.current.value = '';
  };

  const onDrop = (event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setIsDraggingOver(false);
    if (isDisabled) return;
    take(event.dataTransfer.files[0] ?? null);
  };

  const onDragOver = (event: DragEvent<HTMLElement>): void => {
    // Without preventDefault the browser navigates to the dropped file.
    event.preventDefault();
    if (!isDisabled) setIsDraggingOver(true);
  };

  const shown = preview ?? currentUrl;
  const message = error ?? issue ?? undefined;
  const errorId = `${inputId}-error`;
  const thumbnailShape = shape === 'circle' ? 'rounded-pill' : 'rounded-control';

  return (
    <div className="space-y-1.5">
      {label === undefined ? null : <Label htmlFor={inputId}>{label}</Label>}

      <FileInput
        ref={inputRef}
        id={inputId}
        accept={accept.join(',')}
        disabled={isDisabled}
        aria-describedby={message === undefined ? undefined : errorId}
        onChange={(event) => {
          take(event.target.files?.[0] ?? null);
        }}
      />

      {shown === null ? (
        /*
         * Empty: the whole area is the control. One button rather than a
         * clickable div wrapping another button — nested interactive elements
         * are unreachable by keyboard and ambiguous to assistive tech.
         */
        <button
          type="button"
          disabled={isDisabled}
          onClick={openPicker}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={() => {
            setIsDraggingOver(false);
          }}
          className={cn(
            'rounded-surface flex w-full flex-col items-center justify-center gap-2 border-2 border-dashed p-6 transition-colors',
            FOCUS_RING,
            isDisabled
              ? 'border-border text-foreground-disabled cursor-not-allowed'
              : 'cursor-pointer',
            isDraggingOver && !isDisabled
              ? 'border-primary-solid bg-selected'
              : 'border-border-strong bg-sunken hover:bg-muted',
          )}
        >
          <span
            className={cn(
              'bg-card text-muted-foreground rounded-pill flex size-10 items-center justify-center',
              isDraggingOver && !isDisabled && 'text-primary-solid',
            )}
          >
            {isDraggingOver ? (
              <Upload className="size-5" aria-hidden="true" />
            ) : (
              <ImagePlus className="size-5" aria-hidden="true" />
            )}
          </span>
          <span className="text-foreground text-label font-medium">
            {isDraggingOver ? t('imageField.dropHere') : t('imageField.dragOrChoose')}
          </span>
          <span className="text-muted-foreground text-caption">
            {t('imageField.hint', { types: typeNames, size: limit })}
          </span>
        </button>
      ) : (
        /* Chosen: the image itself is the subject, the actions sit beside it. */
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={() => {
            setIsDraggingOver(false);
          }}
          className={cn(
            'rounded-surface flex items-center gap-4 border p-3 transition-colors',
            isDraggingOver && !isDisabled
              ? 'border-primary-solid bg-selected'
              : 'border-border bg-card',
          )}
        >
          <span
            className={cn(
              'border-border bg-sunken flex size-16 shrink-0 items-center justify-center overflow-hidden border',
              thumbnailShape,
            )}
          >
            <img
              src={shown}
              alt={preview === null ? t('imageField.current') : t('imageField.preview')}
              className="size-full object-cover"
            />
          </span>

          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-foreground text-label truncate font-medium">
              {file?.name ?? t('imageField.current')}
            </p>
            <p className="text-muted-foreground text-caption">
              {file === null
                ? t('imageField.hint', { types: typeNames, size: limit })
                : formatFileSize(file.size, language)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDisabled}
              onClick={openPicker}
            >
              {t('imageField.replace')}
            </Button>
            {/* Only what this session added can be taken back: clearing a
                stored image is the owning form's decision, not this one's. */}
            {file === null ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isDisabled}
                onClick={clear}
                aria-label={t('imageField.remove')}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      )}

      {message === undefined ? null : <FieldError id={errorId}>{message}</FieldError>}
    </div>
  );
}
