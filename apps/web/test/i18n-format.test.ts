import { describe, expect, it } from 'vitest';

import {
  EMPTY_VALUE,
  clearFormatterCacheForTests,
  formatDate,
  formatDateTime,
  formatNumber,
} from '@/lib/i18n/format';

const ISO = '2026-01-01T09:30:00.000Z';

describe('formatDate / formatDateTime', () => {
  it('matches Intl for the given locale', () => {
    const expectedEn = new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date(ISO));

    expect(formatDate(ISO, 'en')).toBe(expectedEn);
    expect(formatDate(ISO, 'vi')).not.toBe(expectedEn);
  });

  it('includes the time only in formatDateTime', () => {
    expect(formatDateTime(ISO, 'en')).toContain(formatDate(ISO, 'en'));
    expect(formatDateTime(ISO, 'en').length).toBeGreaterThan(formatDate(ISO, 'en').length);
  });

  it('renders a dash for a missing or unparsable value', () => {
    expect(formatDate(null)).toBe(EMPTY_VALUE);
    expect(formatDate(undefined)).toBe(EMPTY_VALUE);
    expect(formatDate('not-a-date')).toBe(EMPTY_VALUE);
    expect(formatDateTime(null)).toBe(EMPTY_VALUE);
  });

  it('accepts a Date and a timestamp as well as an ISO string', () => {
    const date = new Date(ISO);
    expect(formatDate(date, 'en')).toBe(formatDate(ISO, 'en'));
    expect(formatDate(date.getTime(), 'en')).toBe(formatDate(ISO, 'en'));
  });

  it('keeps working after the formatter cache is dropped', () => {
    const before = formatDate(ISO, 'en');
    clearFormatterCacheForTests();
    expect(formatDate(ISO, 'en')).toBe(before);
  });
});

describe('formatNumber', () => {
  it('groups digits the way the locale does', () => {
    expect(formatNumber(1234567, 'en')).toBe(new Intl.NumberFormat('en').format(1234567));
    expect(formatNumber(1234567, 'vi')).toBe(new Intl.NumberFormat('vi').format(1234567));
  });

  it('passes the options through', () => {
    expect(formatNumber(0.5, 'en', { style: 'percent' })).toBe('50%');
  });

  it('renders a dash for nothing to format', () => {
    expect(formatNumber(null)).toBe(EMPTY_VALUE);
    expect(formatNumber(undefined)).toBe(EMPTY_VALUE);
    expect(formatNumber(Number.NaN)).toBe(EMPTY_VALUE);
  });

  it('formats zero rather than treating it as missing', () => {
    expect(formatNumber(0, 'en')).toBe('0');
  });
});
