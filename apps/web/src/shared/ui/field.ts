/**
 * The shared shell of a text control: Input, Textarea and Select must look like
 * one family, and they only do that while the border, radius, background and
 * focus treatment live in a single string.
 */
import { cn } from '@/lib/utils';

export const FIELD_BASE = cn(
  'bg-card text-foreground w-full rounded-control border transition-colors',
  'outline-none focus-visible:border-input-focus focus-visible:ring-ring/25 focus-visible:ring-2',
  'disabled:cursor-not-allowed disabled:opacity-60',
  'placeholder:text-muted-foreground',
);

export function fieldBorder(hasError: boolean): string {
  return hasError ? 'border-destructive' : 'border-input';
}

/** `aria-describedby` target for a field's error, or undefined when either is absent. */
export function fieldErrorId(id: string | undefined, hasError: boolean): string | undefined {
  return id !== undefined && hasError ? `${id}-error` : undefined;
}
