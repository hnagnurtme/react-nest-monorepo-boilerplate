/**
 * The control height scale. Every interactive control resolves its height from
 * here, so a row of a Button, a Select and an Input lines up without anyone
 * measuring. Call sites pick a `size`; they never pass `h-*` in `className`
 * (rule 11, section B3).
 *
 * 32 / 36 / 44px, not 32 / 40 / 48: this is an admin console, and a 40px default
 * control forces a 56px table row, which halves the rows a list page can show.
 * 44px stays available for the one-per-screen primary action and for touch.
 */
export const CONTROL_HEIGHT = {
  sm: 'h-8',
  md: 'h-9',
  lg: 'h-11',
} as const;

export type ControlSize = keyof typeof CONTROL_HEIGHT;

/** Horizontal padding paired with each height. */
export const CONTROL_PADDING = {
  sm: 'px-2.5',
  md: 'px-3',
  lg: 'px-4',
} as const;

/** Type step paired with each height. */
export const CONTROL_TEXT = {
  sm: 'text-label',
  md: 'text-body',
  lg: 'text-body',
} as const;

/**
 * Square controls — icon buttons, stepper arrows, a cell's action slot. Kept
 * beside the heights so a square control cannot drift from the row it sits in.
 */
export const CONTROL_SIZE = {
  sm: 'size-8',
  md: 'size-9',
  lg: 'size-11',
} as const;
