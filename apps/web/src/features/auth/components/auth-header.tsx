import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { TEXT_LINK } from '@/shared/ui';

import { HeaderBrand } from './header-brand';

interface AuthHeaderProps {
  className?: string;
}

/**
 * Brand and help for the pre-session pages. The language and theme controls
 * used to sit here too; `PublicLayout` owns them now, so a page cannot end up
 * showing a second pair of them.
 */
export function AuthHeader({ className }: AuthHeaderProps) {
  const { t } = useTranslation('auth');

  return (
    <header className={cn('bg-card flex w-full items-center justify-between', className)}>
      <HeaderBrand />
      {/* Right of the brand the layout places its own controls, so this keeps clear of them. */}
      <a href="#support" className={TEXT_LINK}>
        {t('header.needHelp')}
      </a>
    </header>
  );
}
