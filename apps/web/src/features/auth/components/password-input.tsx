import { Eye, EyeOff, Lock } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { LoginFormValues } from '@/features/auth/types';
import { IconButton, Input } from '@/shared/ui';

import { PasswordHeader } from './password-header';

interface PasswordInputProps {
  form: UseFormReturn<LoginFormValues>;
  showPassword: boolean;
  togglePasswordVisibility: () => void;
  onForgotPassword: () => void;
}

export function PasswordInput({
  form,
  showPassword,
  togglePasswordVisibility,
  onForgotPassword,
}: PasswordInputProps) {
  const { t } = useTranslation('auth');
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-1.5">
      {/* The label sits with the "forgot password" action, so it is not Input's own. */}
      <PasswordHeader onForgotPassword={onForgotPassword} />
      <Input
        id="auth-password"
        {...register('password')}
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        placeholder={t('form.passwordPlaceholder')}
        error={errors.password?.message}
        startIcon={<Lock className="size-4" />}
        endAction={
          <IconButton
            size="sm"
            // Not a tab stop: the toggle is a convenience, and keyboard users
            // reach the next field rather than a control that changes nothing.
            tabIndex={-1}
            label={showPassword ? t('form.hidePassword') : t('form.showPassword')}
            onClick={togglePasswordVisibility}
            icon={
              showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )
            }
          />
        }
      />
    </div>
  );
}
