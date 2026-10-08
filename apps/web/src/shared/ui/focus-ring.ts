/**
 * The product's only focus ring. Every interactive primitive concatenates this
 * instead of picking its own width or opacity: a ring that differs per control
 * reads as a rendering bug, and one that is missing is an accessibility defect.
 *
 * `focus-visible` rather than `focus` so a mouse click does not paint a ring the
 * pointer user never asked for, while keyboard and assistive tech still get one.
 */
export const FOCUS_RING =
  'outline-none focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2';

/**
 * For controls that sit flush inside a bordered container (a table cell action,
 * an input adornment) where an offset ring would be clipped by the parent.
 */
export const FOCUS_RING_INSET =
  'outline-none focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-inset';
