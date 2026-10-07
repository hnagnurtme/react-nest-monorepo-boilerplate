import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useRegister } from '@/features/auth/api/use-register';
import { createRegisterSchema } from '@/features/auth/schemas/register.schema';
import type { RegisterDto, RegisterFormValues } from '@/features/auth/types';
import { ApiError } from '@/lib/http/client';
import { useToast } from '@/shared/ui';

export interface UseRegisterFormOptions {
  onRegisterSuccess?: ((email: string) => void) | undefined;
}

export interface UseRegisterFormReturn {
  form: UseFormReturn<RegisterFormValues>;
  showPassword: boolean;
  togglePasswordVisibility: () => void;
  isSubmitting: boolean;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
}

export function useRegisterForm(
  optionsOrSuccess?: UseRegisterFormOptions | ((email: string) => void),
): UseRegisterFormReturn {
  const options =
    typeof optionsOrSuccess === 'function'
      ? { onRegisterSuccess: optionsOrSuccess }
      : optionsOrSuccess;

  const { t } = useTranslation('auth');
  const { showToast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const schema = useMemo(() => createRegisterSchema(t), [t]);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      phoneNumber: '',
      email: '',
      password: '',
      agreeTerms: false,
    },
  });

  const registerMutation = useRegister();

  const handleFormSubmit = form.handleSubmit((data) => {
    const payload: RegisterDto = {
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      agreeTerms: data.agreeTerms,
      ...(data.phoneNumber ? { phoneNumber: data.phoneNumber } : {}),
    };

    registerMutation.mutate(payload, {
      onSuccess: (response) => {
        const email = response.email || data.email;
        options?.onRegisterSuccess?.(email);
      },
      onError: (error) => {
        if (error instanceof ApiError) {
          if (error.invalidParams && error.invalidParams.length > 0) {
            error.invalidParams.forEach((param) => {
              if (
                param.name === 'email' ||
                param.name === 'password' ||
                param.name === 'fullName' ||
                param.name === 'phoneNumber' ||
                param.name === 'agreeTerms'
              ) {
                form.setError(param.name, {
                  message: param.reason,
                });
              }
            });
          } else {
            showToast({ type: 'error', message: error.message });
          }
        } else {
          showToast({ type: 'error', message: t('validation.defaultError') });
        }
      },
    });
  });

  const togglePasswordVisibility = (): void => {
    setShowPassword((prev) => !prev);
  };

  return {
    form,
    showPassword,
    togglePasswordVisibility,
    isSubmitting: registerMutation.isPending,
    onSubmit: handleFormSubmit,
  };
}
