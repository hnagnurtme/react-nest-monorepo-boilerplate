import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useLoginForm } from '@/features/auth/hooks/use-login-form';

import { FastAuthButtons } from './fast-auth-buttons';
import { LoginFormHeader } from './login-form-header';
import { LoginIdentityInput } from './login-identity-input';
import { LoginSubmitButton } from './login-submit-button';
import { PasswordInput } from './password-input';

interface LoginFormProps {
  onForgotPassword: () => void;
}

export function LoginForm({ onForgotPassword }: LoginFormProps) {
  const { t } = useTranslation('auth');
  const { form, showPassword, togglePasswordVisibility, isSubmitting, onSubmit } = useLoginForm();

  return (
    <div className="mx-auto w-full max-w-[420px] space-y-6">
      <LoginFormHeader />

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <LoginIdentityInput form={form} />

        <PasswordInput
          form={form}
          showPassword={showPassword}
          togglePasswordVisibility={togglePasswordVisibility}
          onForgotPassword={onForgotPassword}
        />

        <LoginSubmitButton isSubmitting={isSubmitting} />
      </form>

      <FastAuthButtons />

      {/* Link chuyển sang đăng ký */}
      <p className="text-muted-foreground mt-4 text-center text-sm">
        {t('form.noAccountPrompt')}
        <Link
          to="/register"
          className="text-primary hover:text-primary-hover font-semibold transition-colors"
        >
          {t('form.registerAction')}
        </Link>
      </p>
    </div>
  );
}
