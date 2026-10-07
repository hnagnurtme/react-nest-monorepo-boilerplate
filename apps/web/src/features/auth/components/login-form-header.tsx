import { useTranslation } from 'react-i18next';

export function LoginFormHeader() {
  const { t } = useTranslation('auth');

  return (
    <div className="space-y-1">
      <h1 className="text-foreground text-3xl font-bold tracking-tight">{t('form.title')}</h1>
      <p className="text-muted-foreground text-sm">{t('form.subtitle')}</p>
    </div>
  );
}
