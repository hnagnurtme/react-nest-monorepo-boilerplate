/**
 * The control height scale. Every interactive control resolves its height from
 * here, so a row of a Button, a Select and an Input lines up without anyone
 * measuring. Call sites pick a `size`; they never pass `h-*` in `className`
 * (rule 11, section B3).
 */
export const CONTROL_HEIGHT = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12',
} as const;

export type ControlSize = keyof typeof CONTROL_HEIGHT;

/** Horizontal padding paired with each height. */
export const CONTROL_PADDING = {
  sm: 'px-3',
  md: 'px-3.5',
  lg: 'px-4',
} as const;

/** Type step paired with each height. */
export const CONTROL_TEXT = {
  sm: 'text-label',
  md: 'text-body',
  lg: 'text-body',
} as const;
