import { useTranslation } from 'react-i18next';

export function LoginHeroBanner() {
  const { t } = useTranslation('auth');

  return (
    <div className="bg-primary text-primary-foreground relative flex h-full w-full flex-col items-center justify-center gap-3 p-12 text-center">
      <p className="text-4xl font-bold tracking-tight">{t('header.brandName')}</p>
      <p className="max-w-sm text-base opacity-90">{t('header.tagline')}</p>
    </div>
  );
}
