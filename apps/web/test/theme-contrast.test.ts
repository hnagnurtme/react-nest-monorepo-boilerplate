import { describe, expect, it } from 'vitest';

// Raw globals.css, injected by `define` in vite.config.ts (see the note there).
const CSS = GLOBALS_CSS_RAW;

/** Returns the body of the first `selector { ... }` block, brace-balanced. */
function blockBody(selector: string): string {
  const selectorAt = CSS.indexOf(selector);
  expect(selectorAt, `${selector} not found in globals.css`).toBeGreaterThan(-1);

  const start = CSS.indexOf('{', selectorAt);
  let depth = 0;
  for (let index = start; index < CSS.length; index += 1) {
    const char = CSS[index];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return CSS.slice(start + 1, index);
    }
  }
  throw new Error(`unbalanced braces after ${selector}`);
}

/** Only opaque hex tokens; `--color-overlay` carries alpha and is excluded. */
function hexTokens(body: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const match of body.matchAll(/(--color-[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) tokens.set(name, value.toLowerCase());
  }
  return tokens;
}

const LIGHT = hexTokens(blockBody('@theme'));
const DARK = new Map([...LIGHT, ...hexTokens(blockBody(':root.dark'))]);

function channel(value: number): number {
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const raw = hex.replace('#', '');
  const parts = [raw.slice(0, 2), raw.slice(2, 4), raw.slice(4, 6)].map(
    (part) => Number.parseInt(part, 16) / 255,
  );
  const [r = 0, g = 0, b = 0] = parts;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Every pair the UI actually paints as text on a surface. */
const TEXT_PAIRS: readonly [foreground: string, background: string][] = [
  ['foreground', 'background'],
  ['foreground', 'surface-subtlest'],
  ['card-foreground', 'card'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['primary', 'card'],
  ['primary', 'primary-light'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['destructive-foreground', 'destructive'],
  ['destructive', 'destructive-light'],
  ['success', 'success-light'],
  ['warning', 'warning-light'],
];

/** WCAG 2.1 AA for body text. */
const AA_TEXT = 4.5;

const PALETTES: readonly [name: string, tokens: Map<string, string>][] = [
  ['light', LIGHT],
  ['dark', DARK],
];

describe('theme tokens meet WCAG AA', () => {
  it.each(PALETTES)('%s defines every token the pairs reference', (_name, tokens) => {
    for (const [foreground, background] of TEXT_PAIRS) {
      expect(tokens.get(`--color-${foreground}`)).toBeDefined();
      expect(tokens.get(`--color-${background}`)).toBeDefined();
    }
  });

  it.each(
    PALETTES.flatMap(([name, tokens]) =>
      TEXT_PAIRS.map(([foreground, background]) => [name, tokens, foreground, background] as const),
    ),
  )('%s: %#  text passes 4.5:1', (_name, tokens, foreground, background) => {
    const fg = tokens.get(`--color-${foreground}`) ?? '#000000';
    const bg = tokens.get(`--color-${background}`) ?? '#ffffff';
    const ratio = contrast(fg, bg);

    expect(
      ratio,
      `${foreground} (${fg}) on ${background} (${bg}) is ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('redefines the dark palette rather than inheriting the light one', () => {
    const overridden = hexTokens(blockBody(':root.dark'));

    // A token missing here would silently stay light-on-dark.
    for (const token of [
      '--color-background',
      '--color-foreground',
      '--color-card',
      '--color-card-foreground',
      '--color-muted',
      '--color-muted-foreground',
      '--color-border',
      '--color-primary',
      '--color-destructive',
      '--color-success',
      '--color-warning',
    ]) {
      expect(overridden.get(token), `${token} is not overridden for dark`).toBeDefined();
      expect(overridden.get(token)).not.toBe(LIGHT.get(token));
    }
  });
});
