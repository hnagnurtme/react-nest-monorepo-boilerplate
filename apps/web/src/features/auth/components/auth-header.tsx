import { cn } from '@/lib/utils';

import { HeaderBrand } from './header-brand';

interface AuthHeaderProps {
  className?: string;
}

/**
 * The brand for the pre-session pages. The language and theme controls used to
 * sit here too; `PublicLayout` owns them now, so a page cannot end up showing a
 * second pair of them.
 */
export function AuthHeader({ className }: AuthHeaderProps) {
  return (
    <header className={cn('bg-card flex w-full items-center justify-between', className)}>
      <HeaderBrand />
    </header>
  );
}
