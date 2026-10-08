import { cn } from '@/lib/utils';

import { FOCUS_RING } from './focus-ring';

/**
 * A textual link inside body copy or a page header. Exported as a class string
 * rather than a component so a router `Link` keeps its own navigation behaviour
 * while still taking the product's one link style (rule 11, section E6).
 */
export const TEXT_LINK = cn(
  'text-primary text-body rounded-inner font-semibold hover:underline',
  FOCUS_RING,
);
