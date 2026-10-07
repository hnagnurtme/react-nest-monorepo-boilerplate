import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import { HeaderBrand } from './header-brand';

interface AuthHeaderProps {
  className?: string;
}

export function AuthHeader({ className }: AuthHeaderProps) {
  const { t } = useTranslation('auth');

  return (
    <header className={cn('bg-card flex w-full items-center justify-between', className)}>
      <HeaderBrand />
      <a
        href="#support"
        className="text-foreground/80 hover:text-primary cursor-pointer text-sm font-medium transition-colors"
      >
        {t('header.needHelp')}
      </a>
    </header>
  );
}
