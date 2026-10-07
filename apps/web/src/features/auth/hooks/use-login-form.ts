import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useMemo } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useLogin } from '@/features/auth/api/use-login';
import { createLoginSchema } from '@/features/auth/schemas/login.schema';
import type { LoginFormValues } from '@/features/auth/types';
import { ApiError } from '@/lib/http/client';
import { useToast } from '@/shared/ui';

export interface UseLoginFormReturn {
  form: UseFormReturn<LoginFormValues>;
  showPassword: boolean;
  togglePasswordVisibility: () => void;
  isSubmitting: boolean;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
}

export function useLoginForm(): UseLoginFormReturn {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const schema = useMemo(() => createLoginSchema(t), [t]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const loginMutation = useLogin();

  const handleFormSubmit = form.handleSubmit((data) => {
    loginMutation.mutate(
      { email: data.email, password: data.password },
      {
        onSuccess: () => {
          void navigate('/', { replace: true });
        },
        onError: (error) => {
          if (error instanceof ApiError) {
            if (error.invalidParams && error.invalidParams.length > 0) {
              error.invalidParams.forEach((param) => {
                if (param.name === 'email' || param.name === 'password') {
                  form.setError(param.name, { message: param.reason });
                }
              });
            } else {
              showToast({ type: 'error', message: error.message });
            }
          } else {
            showToast({ type: 'error', message: t('validation.defaultError') });
          }
        },
      },
    );
  });

  const togglePasswordVisibility = (): void => {
    setShowPassword((prev) => !prev);
  };

  return {
    form,
    showPassword,
    togglePasswordVisibility,
    isSubmitting: loginMutation.isPending,
    onSubmit: handleFormSubmit,
  };
}
