import { FALLBACK_LANGUAGE, type AppLanguage } from '@/lib/i18n/languages';

/**
 * `Intl.*Format` construction is the expensive part, so instances are cached per
 * locale and option set. Without this, a 100-row table builds 100 formatters.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

function dateFormatter(
  locale: AppLanguage,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `d:${locale}:${JSON.stringify(options)}`;
  const cached = formatterCache.get(key);
  if (cached instanceof Intl.DateTimeFormat) return cached;

  const formatter = new Intl.DateTimeFormat(locale, options);
  formatterCache.set(key, formatter);
  return formatter;
}

function numberFormatter(
  locale: AppLanguage,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `n:${locale}:${JSON.stringify(options)}`;
  const cached = formatterCache.get(key);
  if (cached instanceof Intl.NumberFormat) return cached;

  const formatter = new Intl.NumberFormat(locale, options);
  formatterCache.set(key, formatter);
  return formatter;
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
};

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTIONS,
  hour: '2-digit',
  minute: '2-digit',
};

/** An API timestamp is an ISO string; an unparsable one renders as an em dash. */
function toDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const EMPTY_VALUE = '—';

export function formatDate(
  value: Date | string | number | null | undefined,
  locale: AppLanguage = FALLBACK_LANGUAGE,
): string {
  if (value === null || value === undefined) return EMPTY_VALUE;
  const date = toDate(value);
  return date === null ? EMPTY_VALUE : dateFormatter(locale, DATE_OPTIONS).format(date);
}

export function formatDateTime(
  value: Date | string | number | null | undefined,
  locale: AppLanguage = FALLBACK_LANGUAGE,
): string {
  if (value === null || value === undefined) return EMPTY_VALUE;
  const date = toDate(value);
  return date === null ? EMPTY_VALUE : dateFormatter(locale, DATE_TIME_OPTIONS).format(date);
}

export function formatNumber(
  value: number | null | undefined,
  locale: AppLanguage = FALLBACK_LANGUAGE,
  options: Intl.NumberFormatOptions = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY_VALUE;
  return numberFormatter(locale, options).format(value);
}

/** @internal Test seam: formatters are cached for the lifetime of the page. */
export function clearFormatterCacheForTests(): void {
  formatterCache.clear();
}
