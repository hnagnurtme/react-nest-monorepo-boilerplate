import { useMemo } from 'react';

import { formatDate, formatDateTime, formatNumber } from '@/lib/i18n/format';

import { useLanguage } from './use-language';

export interface Formatters {
  /** Short date, e.g. "07 Oct 2026" / "07 thg 10, 2026". */
  date: (value: Date | string | number | null | undefined) => string;
  dateTime: (value: Date | string | number | null | undefined) => string;
  number: (value: number | null | undefined, options?: Intl.NumberFormatOptions) => string;
}

/**
 * Locale-aware date and number formatting bound to the current UI language, so
 * switching language reformats the table instead of only its labels.
 */
export function useFormatters(): Formatters {
  const { language } = useLanguage();

  return useMemo(
    () => ({
      date: (value) => formatDate(value, language),
      dateTime: (value) => formatDateTime(value, language),
      number: (value, options) => formatNumber(value, language, options),
    }),
    [language],
  );
}
