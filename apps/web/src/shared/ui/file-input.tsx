import { forwardRef, type InputHTMLAttributes } from 'react';

export interface FileInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value'
> {
  /** Comma-separated media types, e.g. `image/png,image/jpeg`. */
  accept: string;
}

/**
 * The file picker, visually hidden and driven by a Button beside it.
 *
 * A native `<input type="file">` cannot be styled to the control scale — the
 * browser draws its own button and ignores the usual properties — so the design
 * system hides it rather than pretending. It stays a real focusable input, so
 * keyboard and assistive tech reach it through its label; only the browser's
 * chrome is out of the way.
 */
export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  function FileInput(props, ref) {
    return <input ref={ref} type="file" className="sr-only" {...props} />;
  },
);
