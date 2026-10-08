import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils';

/**
 * These are not style assertions; they guard the merge rules. Every one of them
 * failed before `extendTailwindMerge` learned the project's role-named scales,
 * and each failure was silent: the class simply vanished from the output.
 */
describe('cn', () => {
  it('keeps a text colour next to a role-named type step', () => {
    // The original defect: a primary button lost its colour to the size class
    // and its label inherited `foreground`, so dark green rendered near-black.
    const merged = cn('bg-primary text-primary-foreground', 'text-label');

    expect(merged).toContain('text-primary-foreground');
    expect(merged).toContain('text-label');
  });

  it('keeps a role-named type step next to a text colour', () => {
    const merged = cn('text-caption', 'text-muted-foreground');

    expect(merged).toContain('text-caption');
    expect(merged).toContain('text-muted-foreground');
  });

  it('still resolves two type steps to the last one', () => {
    expect(cn('text-body', 'text-caption')).toBe('text-caption');
  });

  it('still resolves two text colours to the last one', () => {
    expect(cn('text-foreground', 'text-destructive')).toBe('text-destructive');
  });

  it('resolves the role-named radius and shadow scales', () => {
    expect(cn('rounded-control', 'rounded-surface')).toBe('rounded-surface');
    expect(cn('shadow-raised', 'shadow-overlay')).toBe('shadow-overlay');
  });
});
