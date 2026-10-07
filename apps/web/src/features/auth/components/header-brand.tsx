import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/utils';

interface HeaderBrandProps {
  className?: string;
}

export function HeaderBrand({ className }: HeaderBrandProps) {
  const { t } = useTranslation('auth');

  return (
    <Link
      to="/"
      className={cn(
        'focus-visible:outline-hidden focus-visible:ring-ring text-foreground inline-flex items-center gap-2 rounded-md text-xl font-bold tracking-tight transition-opacity hover:opacity-90 focus-visible:ring-2',
        className,
      )}
      aria-label={t('header.brandAlt')}
    >
      {t('header.brandName')}
    </Link>
  );
}
