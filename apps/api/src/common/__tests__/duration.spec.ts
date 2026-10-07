import { describe, expect, it } from 'vitest';

import { parseDuration, slugify } from '@/common/utils/index.js';

describe('parseDuration', () => {
  it.each([
    ['500ms', 500],
    ['30s', 30_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['7d', 604_800_000],
  ])('parses %s', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it('throws on a unit it does not understand rather than guessing', () => {
    expect(() => parseDuration('1w')).toThrow(RangeError);
  });

  it('throws on a bare number', () => {
    expect(() => parseDuration('900')).toThrow(RangeError);
  });
});

describe('slugify', () => {
  it('strips Vietnamese diacritics', () => {
    expect(slugify('Trà Shan Tuyết Hà Giang')).toBe('tra-shan-tuyet-ha-giang');
  });

  it('keeps the d in đ, which NFD does not decompose', () => {
    expect(slugify('Đồng Tháp')).toBe('dong-thap');
  });

  it('collapses punctuation and trims the edges', () => {
    expect(slugify('  Sen -- Đồng Tháp!  ')).toBe('sen-dong-thap');
  });
});
