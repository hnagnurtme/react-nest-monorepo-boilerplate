/**
 * Money is an integer count of the smallest currency unit — VND đồng, USD
 * cents (docs/rules/02-backend-nestjs.md E4). Floats are banned outright:
 * `0.1 + 0.2` is `0.30000000000000004`, and that error compounds across an
 * order's line items.
 */

const DECIMAL_PLACES: Record<string, number> = {
  VND: 0,
  USD: 2,
  EUR: 2,
};

const DEFAULT_CURRENCY = 'VND';
const RADIX = 10;
const ZERO = 0n;
const ONE = 1n;
const MINUS_ONE = -1n;

export function decimalPlacesFor(currencyCode: string): number {
  return DECIMAL_PLACES[currencyCode.toUpperCase()] ?? 2;
}

/** Formats minor units for display. Never use the result in arithmetic. */
export function formatMinor(amountMinor: bigint, currencyCode = DEFAULT_CURRENCY): string {
  const places = decimalPlacesFor(currencyCode);
  if (places === 0) return amountMinor.toString(RADIX);

  const divisor = BigInt(RADIX ** places);
  const negative = amountMinor < ZERO;
  const absolute = negative ? -amountMinor : amountMinor;
  const whole = absolute / divisor;
  const fraction = (absolute % divisor).toString(RADIX).padStart(places, '0');

  return `${negative ? '-' : ''}${whole.toString(RADIX)}.${fraction}`;
}

/**
 * Splits an amount into `parts` shares that sum back to exactly the original.
 * The remainder is handed out one minor unit at a time to the first shares, so
 * no fraction of a đồng is created or lost — the failure mode that makes
 * commission splits disagree with the ledger.
 */
export function allocateMinor(amountMinor: bigint, parts: number): bigint[] {
  if (parts < 1 || !Number.isInteger(parts)) {
    throw new RangeError('parts must be a positive integer');
  }

  const divisor = BigInt(parts);
  const base = amountMinor / divisor;
  let remainder = amountMinor - base * divisor;
  const step = remainder < ZERO ? MINUS_ONE : ONE;

  return Array.from({ length: parts }, () => {
    if (remainder === ZERO) return base;
    remainder -= step;
    return base + step;
  });
}
