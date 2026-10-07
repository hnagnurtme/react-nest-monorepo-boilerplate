import { useTranslation } from 'react-i18next';

export function RegisterFormHeader() {
  const { t } = useTranslation('auth');

  return (
    <div>
      <h1 className="text-foreground text-3xl font-bold tracking-tight">{t('register.title')}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{t('register.subtitle')}</p>
    </div>
  );
}
