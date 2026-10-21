import { describe, expect, it } from 'vitest';

// Raw globals.css, injected by `define` in vite.config.ts (see the note there).
const CSS = GLOBALS_CSS_RAW;

/**
 * Returns the body of the first `selector { ... }` block, brace-balanced.
 *
 * The selector is matched at the start of a line, not anywhere in the file: a
 * comment that merely names `:root.dark` used to win the `indexOf`, and the
 * block that came back was the comment's own, so every dark token read as
 * missing.
 */
function blockBody(selector: string): string {
  const anchor = new RegExp(String.raw`^${selector.replace('.', String.raw`\.`)}\s*\{`, 'm');
  const selectorAt = CSS.search(anchor);
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

/**
 * Every `--color-*` declaration as written, which since the two-layer token
 * refactor is usually `var(--color-<scale>-<step>)` rather than a hex: the
 * semantic layer picks a step off a ramp instead of inventing a value.
 */
function declarations(body: string): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const match of body.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) tokens.set(name, value.trim().toLowerCase());
  }
  return tokens;
}

const HEX = /^#[0-9a-f]{6}$/;
const VAR_REFERENCE = /^var\((--color-[\w-]+)\)$/;
const MAX_INDIRECTION = 8;

/**
 * Follows a semantic token down to the hex on its scale. Returns undefined for
 * the tokens that carry no opaque colour (`--color-overlay` has alpha, and
 * transparent/currentColor are keywords), so a pair naming one of those fails
 * the "is defined" test rather than silently contrasting against black.
 */
function resolve(name: string, raw: Map<string, string>): string | undefined {
  let value = raw.get(name);
  for (let hop = 0; value !== undefined && hop < MAX_INDIRECTION; hop += 1) {
    if (HEX.test(value)) return value;
    const reference = VAR_REFERENCE.exec(value);
    if (reference?.[1] === undefined) return undefined;
    value = raw.get(reference[1]);
  }
  return undefined;
}

const LIGHT_RAW = declarations(blockBody('@theme'));
const DARK_OVERRIDES = declarations(blockBody(':root.dark'));
/* Dark redefines the semantic layer only, so it inherits every scale step. */
const DARK_RAW = new Map([...LIGHT_RAW, ...DARK_OVERRIDES]);

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
  ['foreground', 'card'],
  ['foreground', 'muted'],
  ['card-foreground', 'card'],
  ['foreground-secondary', 'card'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['muted-foreground', 'sunken'],
  ['muted-foreground', 'chip'],
  // The archipelago names, drawn straight onto the map's water.
  ['muted-foreground', 'map-sea'],
  ['primary', 'card'],
  ['primary', 'primary-light'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['foreground', 'selected'],
  ['destructive-foreground', 'destructive'],
  ['destructive', 'destructive-light'],
  ['success', 'success-light'],
  ['warning', 'warning-light'],
  ['info', 'info-light'],
  ['tooltip-foreground', 'tooltip'],
];

/**
 * Boundaries and meaningful graphics, which WCAG 2.1 SC 1.4.11 holds to 3:1 —
 * the rule the text pairs below do not cover and the one that let an input
 * border ship at 1.53:1. A pair belongs here when losing it costs the user
 * information: the edge that says where a control is, the focus indicator, an
 * icon or a status dot drawn with no label of its own. Decorative hairlines
 * (`border`, `border-strong` between table rows) are deliberately absent.
 */
const UI_PAIRS: readonly [foreground: string, background: string][] = [
  ['input', 'card'],
  ['input', 'background'],
  ['input-focus', 'card'],
  ['ring', 'card'],
  ['ring', 'background'],
  // Icon-only buttons and the StatusDot tones paint these on a row.
  ['primary', 'card'],
  ['destructive', 'card'],
  ['success', 'card'],
  ['muted-foreground', 'card'],
];

/**
 * The tenant map, which paints on its own sea rather than on a page surface and
 * so is covered by none of the pairs above.
 *
 * The bands themselves are absent on purpose: a wash is 1.02–1.13:1 against the
 * water by design, and raising it to 3:1 would turn the map into a flag. What
 * has to be visible is the coast that encloses the wash, the brand fill that
 * says a province is held or selected, and the leader lines that tie each
 * region's count back to its band — all of which are below.
 */
const MAP_PAIRS: readonly [foreground: string, background: string][] = [
  ['region-north-line', 'map-sea'],
  ['region-central-line', 'map-sea'],
  ['region-south-line', 'map-sea'],
  // The same coast seen from the land side.
  ['region-north-line', 'region-north-surface'],
  ['region-central-line', 'region-central-surface'],
  ['region-south-line', 'region-south-surface'],
  ['map-held', 'map-sea'],
  ['map-active', 'map-sea'],
  // `map-*-line` is not held to its own fill: a brand province is edged in a
  // darker step of the colour it is filled with, so the two are one object and
  // the boundary that carries meaning is the one against the water, above. The
  // pin drawn in that same line colour is separated by its `card` ring, not by
  // a luminance step.
];

/** WCAG 2.1 AA for body text. */
const AA_TEXT = 4.5;

/** WCAG 2.1 AA for user-interface components and graphical objects. */
const AA_NON_TEXT = 3;

const PALETTES: readonly [name: string, tokens: Map<string, string>][] = [
  ['light', LIGHT_RAW],
  ['dark', DARK_RAW],
];

describe('theme tokens meet WCAG AA', () => {
  it.each(PALETTES)('%s resolves every token the pairs reference', (_name, tokens) => {
    for (const [foreground, background] of TEXT_PAIRS) {
      expect(resolve(`--color-${foreground}`, tokens), `--color-${foreground}`).toBeDefined();
      expect(resolve(`--color-${background}`, tokens), `--color-${background}`).toBeDefined();
    }
  });

  it.each(
    PALETTES.flatMap(([name, tokens]) =>
      TEXT_PAIRS.map(([foreground, background]) => [name, tokens, foreground, background] as const),
    ),
  )('%s: %#  text passes 4.5:1', (_name, tokens, foreground, background) => {
    const fg = resolve(`--color-${foreground}`, tokens) ?? '#000000';
    const bg = resolve(`--color-${background}`, tokens) ?? '#ffffff';
    const ratio = contrast(fg, bg);

    expect(
      ratio,
      `${foreground} (${fg}) on ${background} (${bg}) is ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(PALETTES)('%s resolves every token the UI pairs reference', (_name, tokens) => {
    for (const [foreground, background] of UI_PAIRS) {
      expect(resolve(`--color-${foreground}`, tokens), `--color-${foreground}`).toBeDefined();
      expect(resolve(`--color-${background}`, tokens), `--color-${background}`).toBeDefined();
    }
  });

  it.each(
    PALETTES.flatMap(([name, tokens]) =>
      UI_PAIRS.map(([foreground, background]) => [name, tokens, foreground, background] as const),
    ),
  )('%s: %#  boundary passes 3:1', (_name, tokens, foreground, background) => {
    const fg = resolve(`--color-${foreground}`, tokens) ?? '#000000';
    const bg = resolve(`--color-${background}`, tokens) ?? '#ffffff';
    const ratio = contrast(fg, bg);

    expect(
      ratio,
      `${foreground} (${fg}) on ${background} (${bg}) is ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it.each(PALETTES)('%s resolves every token the map pairs reference', (_name, tokens) => {
    for (const [foreground, background] of MAP_PAIRS) {
      expect(resolve(`--color-${foreground}`, tokens), `--color-${foreground}`).toBeDefined();
      expect(resolve(`--color-${background}`, tokens), `--color-${background}`).toBeDefined();
    }
  });

  it.each(
    PALETTES.flatMap(([name, tokens]) =>
      MAP_PAIRS.map(([foreground, background]) => [name, tokens, foreground, background] as const),
    ),
  )('%s: %#  map mark passes 3:1', (_name, tokens, foreground, background) => {
    const fg = resolve(`--color-${foreground}`, tokens) ?? '#000000';
    const bg = resolve(`--color-${background}`, tokens) ?? '#ffffff';
    const ratio = contrast(fg, bg);

    expect(
      ratio,
      `${foreground} (${fg}) on ${background} (${bg}) is ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it('redefines the dark palette rather than inheriting the light one', () => {
    // A token missing here would silently stay light-on-dark.
    for (const token of [
      '--color-background',
      '--color-foreground',
      '--color-foreground-secondary',
      '--color-card',
      '--color-card-foreground',
      '--color-muted',
      '--color-muted-foreground',
      '--color-sunken',
      '--color-selected',
      '--color-border',
      '--color-primary',
      '--color-destructive',
      '--color-success',
      '--color-warning',
      '--color-info',
      '--color-tooltip',
    ]) {
      expect(DARK_OVERRIDES.get(token), `${token} is not overridden for dark`).toBeDefined();
      expect(resolve(token, DARK_RAW)).not.toBe(resolve(token, LIGHT_RAW));
    }
  });

  it('keeps the scales out of the dark override block', () => {
    // A ramp that flips per theme stops being a ramp; only layer 2 may move.
    const scaleSteps = [...DARK_OVERRIDES.keys()].filter((name) => /-(?:\d{2,3})$/.test(name));

    expect(scaleSteps).toEqual([]);
  });
});
