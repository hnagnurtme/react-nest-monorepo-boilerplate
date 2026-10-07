import { describe, expect, it } from 'vitest';

import { allocateMinor, decimalPlacesFor, formatMinor } from '@/common/utils/index.js';

describe('decimalPlacesFor', () => {
  it('knows VND has no minor unit', () => {
    expect(decimalPlacesFor('VND')).toBe(0);
  });

  it('falls back to two places for an unknown currency', () => {
    expect(decimalPlacesFor('CHF')).toBe(2);
  });
});

describe('formatMinor', () => {
  it('renders VND without a decimal point', () => {
    expect(formatMinor(50_000n, 'VND')).toBe('50000');
  });

  it('pads the fractional part of a two-place currency', () => {
    expect(formatMinor(705n, 'USD')).toBe('7.05');
  });

  it('keeps the sign outside the digits', () => {
    expect(formatMinor(-705n, 'USD')).toBe('-7.05');
  });
});

describe('allocateMinor', () => {
  it('splits evenly when it divides', () => {
    expect(allocateMinor(900n, 3)).toEqual([300n, 300n, 300n]);
  });

  it('never creates or loses a minor unit', () => {
    const shares = allocateMinor(100n, 3);

    // 33.33 each would lose a unit; the remainder goes to the earliest shares.
    expect(shares).toEqual([34n, 33n, 33n]);
    expect(shares.reduce((sum, share) => sum + share, 0n)).toBe(100n);
  });

  it('handles a negative amount without drifting', () => {
    const shares = allocateMinor(-100n, 3);

    expect(shares.reduce((sum, share) => sum + share, 0n)).toBe(-100n);
  });

  it('rejects a non-positive part count', () => {
    expect(() => allocateMinor(100n, 0)).toThrow(RangeError);
  });
});
