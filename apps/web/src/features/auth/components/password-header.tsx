import { useTranslation } from 'react-i18next';

import { Label, LinkButton } from '@/shared/ui';

interface PasswordHeaderProps {
  onForgotPassword: () => void;
}

export function PasswordHeader({ onForgotPassword }: PasswordHeaderProps) {
  const { t } = useTranslation('auth');

  return (
    <div className="flex items-center justify-between">
      <Label htmlFor="auth-password">{t('form.passwordLabel')}</Label>
      <LinkButton size="small" onClick={onForgotPassword}>
        {t('form.forgotPassword')}
      </LinkButton>
    </div>
  );
}
