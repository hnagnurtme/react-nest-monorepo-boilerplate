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
    <Input
      id="auth-identity"
      label={t('form.identityLabel')}
      {...register('email')}
      type="text"
      autoComplete="username"
      placeholder={t('form.identityPlaceholder')}
      error={errors.email?.message}
      startIcon={<Mail className="size-4" />}
    />
  );
}
