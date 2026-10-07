import { Mail } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { LoginFormValues } from '@/features/auth/types';
import { Input } from '@/shared/ui';

interface LoginIdentityInputProps {
  form: UseFormReturn<LoginFormValues>;
}

export function LoginIdentityInput({ form }: LoginIdentityInputProps) {
  const { t } = useTranslation('auth');
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-1.5">
      <label htmlFor="auth-identity" className="text-foreground text-sm font-medium">
        {t('form.identityLabel')}
      </label>
      <div className="relative">
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Mail className="h-4 w-4" />
        </span>
        <Input
          id="auth-identity"
          {...register('email')}
          type="text"
          autoComplete="username"
          placeholder={t('form.identityPlaceholder')}
          error={errors.email?.message}
          className="h-11 rounded-xl pl-10"
        />
      </div>
    </div>
  );
}
