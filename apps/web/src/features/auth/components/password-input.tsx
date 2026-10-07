import { Lock, Eye, EyeOff } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { LoginFormValues } from '@/features/auth/types';
import { Input } from '@/shared/ui';

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
      <PasswordHeader onForgotPassword={onForgotPassword} />
      <div className="relative">
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Lock className="h-4 w-4" />
        </span>
        <Input
          id="auth-password"
          {...register('password')}
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder={t('form.passwordPlaceholder')}
          error={errors.password?.message}
          className="h-11 pl-10 pr-10"
        />
        <button
          type="button"
          aria-label={showPassword ? t('form.hidePassword') : t('form.showPassword')}
          onClick={togglePasswordVisibility}
          className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
