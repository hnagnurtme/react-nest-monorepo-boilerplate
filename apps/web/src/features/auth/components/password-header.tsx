import { useTranslation } from 'react-i18next';

interface PasswordHeaderProps {
  onForgotPassword: () => void;
}

export function PasswordHeader({ onForgotPassword }: PasswordHeaderProps) {
  const { t } = useTranslation('auth');

  return (
    <div className="flex items-center justify-between">
      <label htmlFor="auth-password" className="text-foreground text-sm font-medium">
        {t('form.passwordLabel')}
      </label>
      <button
        type="button"
        onClick={onForgotPassword}
        className="text-primary hover:text-primary-hover cursor-pointer text-xs font-semibold transition-colors"
      >
        {t('form.forgotPassword')}
      </button>
    </div>
  );
}
