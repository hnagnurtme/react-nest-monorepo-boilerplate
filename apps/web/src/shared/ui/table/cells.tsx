import { Check, Minus } from 'lucide-react';
import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { TEXT_LINK } from '@/shared/ui/link';

/**
 * One mark for "there is no value here". Blank reads as a rendering bug, "N/A"
 * and "null" read as data, and three different pages picking three of them is
 * how a table starts looking unmaintained.
 */
export const EMPTY_CELL = '—';

export function EmptyCell() {
  return <span className="text-muted-foreground">{EMPTY_CELL}</span>;
}

export interface TextCellProps {
  value: string | null | undefined;
  /** A second, quieter line — a code, an email, a slug. */
  secondary?: string | null | undefined;
}

/**
 * `title` rather than a tooltip component: a truncated cell needs the full value
 * on hover in every row of every table, and a portal per cell is a lot of DOM
 * for a string the browser will show for free.
 */
export function TextCell({ value, secondary }: TextCellProps) {
  if (value === null || value === undefined || value === '') return <EmptyCell />;

  return (
    <div className="min-w-0">
      <p title={value} className="truncate">
        {value}
      </p>
      {secondary === null || secondary === undefined || secondary === '' ? null : (
        <p title={secondary} className="text-muted-foreground text-caption truncate">
          {secondary}
        </p>
      )}
    </div>
  );
}

export interface IdentityCellProps {
  to: string;
  primary: string;
  secondary?: string | null | undefined;
}

/**
 * The row's name, and the row's only navigation. A real `<Link>` so the keyboard
 * reaches it, the screen reader announces it, and "open in new tab" works —
 * none of which a click handler on the `<tr>` can offer.
 */
export function IdentityCell({ to, primary, secondary }: IdentityCellProps) {
  return (
    <div className="min-w-0">
      <Link to={to} title={primary} className={cn(TEXT_LINK, 'block truncate font-medium')}>
        {primary}
      </Link>
      {secondary === null || secondary === undefined || secondary === '' ? null : (
        <p title={secondary} className="text-muted-foreground text-caption truncate">
          {secondary}
        </p>
      )}
    </div>
  );
}

/** IDs, keys, slugs: monospace so two of them can be compared by eye. */
export function CodeCell({ value }: { value: string | null | undefined }) {
  if (value === null || value === undefined || value === '') return <EmptyCell />;

  return (
    <code title={value} className="text-caption bg-muted rounded-inner px-1.5 py-0.5 font-mono">
      {value}
    </code>
  );
}

export interface NumberCellProps {
  value: number | null | undefined;
  unit?: string;
}

export function NumberCell({ value, unit }: NumberCellProps) {
  if (value === null || value === undefined) return <EmptyCell />;

  return (
    <span className="tabular-nums">
      {value}
      {unit === undefined ? null : <span className="text-muted-foreground ml-1">{unit}</span>}
    </span>
  );
}

export interface DateTimeCellProps {
  /** Pre-formatted by `use-formatters`; the cell does not know the locale. */
  value: string | null | undefined;
  /** The absolute timestamp, shown on hover when `value` is relative. */
  title?: string;
}

export function DateTimeCell({ value, title }: DateTimeCellProps) {
  if (value === null || value === undefined || value === '') return <EmptyCell />;

  return (
    <span title={title} className="whitespace-nowrap tabular-nums">
      {value}
    </span>
  );
}

export interface BooleanCellProps {
  value: boolean;
  /** The accessible name of the true state, e.g. "Active". */
  label: string;
}

export function BooleanCell({ value, label }: BooleanCellProps) {
  return (
    <span className="flex items-center justify-center">
      {value ? (
        <Check aria-label={label} className="text-success size-4" />
      ) : (
        <Minus aria-label={`${label}: ${EMPTY_CELL}`} className="text-muted-foreground size-4" />
      )}
    </span>
  );
}

export interface BadgeGroupCellProps {
  children: ReactNode;
  /** How many more exist than are rendered, if the page caps the list. */
  overflowCount?: number;
}

export function BadgeGroupCell({ children, overflowCount }: BadgeGroupCellProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {children}
      {overflowCount !== undefined && overflowCount > 0 ? (
        <span className="text-muted-foreground text-caption">{`+${String(overflowCount)}`}</span>
      ) : null}
    </div>
  );
}

/**
 * Actions stay out of the tab order until the row is hovered or something inside
 * it is focused — `focus-within` is what keeps them reachable by keyboard, so
 * the reveal is a visual nicety and never a trap.
 */
export function ActionsCell({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
      {children}
    </div>
  );
}
