#!/usr/bin/env node
/**
 * Enforces the mechanical parts of docs/rules/11-ui-design-system.md.
 *
 * Every check here exists because the rule it guards was previously review-only,
 * and a styling rule that only a reviewer enforces is a rule that drifts. Each
 * one reports file:line so the fix is obvious, and each names the rule section.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const WEB_SRC = join(ROOT, 'apps/web/src');

/** Walks the tree rather than using fs.globSync, which needs Node 22. */
function filesUnder(directory, extensions) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...filesUnder(path, extensions));
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      found.push(path);
    }
  }
  return found;
}

/** The Tailwind default palette families. Using one bypasses the theme. */
const PALETTE_FAMILIES = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
].join('|');

const CHECKS = [
  {
    id: 'A4 hard-coded colour',
    pattern: /\[#[0-9a-fA-F]{3,8}\]/g,
    hint: 'use a --color-* token (bg-primary, text-muted-foreground, ...)',
  },
  {
    id: 'A4 default Tailwind palette',
    pattern: new RegExp(
      String.raw`\b(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|shadow|accent|caret|decoration|placeholder)-(?:${PALETTE_FAMILIES})-\d{2,3}\b`,
      'g',
    ),
    hint: 'the default palette does not follow the theme; use a project token',
  },
  {
    id: 'A5 arbitrary length',
    pattern: /-\[\d+(?:\.\d+)?(?:px|rem|em)\]/g,
    hint: 'declare a token in @theme, then use the token utility',
  },
  {
    id: 'A2 radius outside the role scale',
    pattern: /\brounded(?:-[trbl]{1,2})?-(?:sm|md|lg|xl|2xl|3xl|full)\b/g,
    hint: 'use rounded-control | rounded-surface | rounded-overlay | rounded-inner | rounded-pill',
  },
  {
    id: 'B2 type step outside the role scale',
    pattern: /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)\b/g,
    hint: 'use text-display | text-title | text-heading | text-body | text-label | text-caption',
  },
  {
    id: 'A2 shadow outside the elevation scale',
    pattern: /\bshadow-(?:sm|md|lg|xl|2xl)\b/g,
    hint: 'use shadow-raised | shadow-floating | shadow-overlay',
  },
  {
    id: 'B4 square icon written as a height/width pair',
    pattern: /\bh-(\d+(?:\.\d+)?) w-\1\b/g,
    hint: 'use size-N',
  },
  {
    id: 'C4 emoji in the interface',
    // Pictographs and dingbats. Plain punctuation and arrows are not emoji.
    pattern: /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F0FF}\u{2600}-\u{27BF}\u{FE0F}]/gu,
    hint: 'use a lucide icon plus a colour token; emoji do not follow the theme',
  },
];

/** Component source plus the locale files, where emoji also must not appear. */
const TARGETS = [
  ...filesUnder(WEB_SRC, ['.ts', '.tsx']),
  ...filesUnder(join(WEB_SRC, 'lib/i18n/locales'), ['.json']),
];

const failures = [];

for (const file of TARGETS) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');

  lines.forEach((line, index) => {
    // A line may opt out with a reason, the same escape hatch ESLint rules get.
    if (line.includes('ui-conventions-allow')) return;

    for (const check of CHECKS) {
      const matches = line.match(check.pattern);
      if (matches === null) continue;
      failures.push(
        `${relative('.', file)}:${String(index + 1)}  ${check.id}: ${matches.join(', ')}\n    ${check.hint}`,
      );
    }
  });
}

if (failures.length > 0) {
  console.error(`UI convention violations (docs/rules/11-ui-design-system.md):\n`);
  console.error(failures.join('\n'));
  console.error(`\n${String(failures.length)} violation(s).`);
  process.exit(1);
}

console.log('UI conventions: no violations.');
