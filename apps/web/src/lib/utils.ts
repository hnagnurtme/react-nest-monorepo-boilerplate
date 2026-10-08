import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge has to be taught this project's scales, or it resolves the
 * wrong conflicts.
 *
 * Its `font-size` group only recognises Tailwind's own t-shirt steps, so a
 * role-named step such as the `body` one falls through to the `text-color`
 * group, lands in the same group as a colour like `primary-foreground`, and the
 * later class silently removes the earlier one. That is not hypothetical: it is
 * why `cn('bg-primary text-primary-foreground', CONTROL_TEXT.md)` emitted a
 * primary button with no colour at all, whose label inherited `foreground` and
 * rendered near-black on dark green.
 *
 * The radius and shadow scales are listed for the same reason — a role name is
 * not a t-shirt size, and an unrecognised class is one that cannot be merged.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'title', 'heading', 'body', 'label', 'caption'] }],
      rounded: [{ rounded: ['control', 'surface', 'overlay', 'inner', 'pill'] }],
      shadow: [{ shadow: ['raised', 'floating', 'overlay'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
