const DURATION_PATTERN = /^(\d+)(ms|s|m|h|d)$/u;

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;
const MS_PER_HOUR = MINUTES_PER_HOUR * MS_PER_MINUTE;

const MS_PER_UNIT: Record<string, number> = {
  ms: 1,
  s: MS_PER_SECOND,
  m: MS_PER_MINUTE,
  h: MS_PER_HOUR,
  d: HOURS_PER_DAY * MS_PER_HOUR,
};

const RADIX = 10;

/**
 * Parses the `15m` / `7d` duration strings used for token TTLs into
 * milliseconds. `jsonwebtoken` accepts these directly, but cookie `maxAge` and
 * Redis denylist TTLs need a number, and re-deriving it by hand in each caller
 * is how the cookie and the token end up disagreeing about when a session ends.
 */
export function parseDuration(value: string): number {
  const match = DURATION_PATTERN.exec(value);
  const amount = match?.[1];
  const unit = match?.[2];

  if (amount === undefined || unit === undefined) {
    throw new RangeError(`Unsupported duration: "${value}" (expected e.g. "15m", "7d")`);
  }

  return Number.parseInt(amount, RADIX) * (MS_PER_UNIT[unit] ?? 0);
}
