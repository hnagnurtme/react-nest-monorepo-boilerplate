import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Mail } from 'lucide-react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { createForgotPasswordSchema } from '@/features/auth/schemas/forgot-password.schema';
import type { ForgotPasswordFormValues } from '@/features/auth/types';
import { Button, Input } from '@/shared/ui';

export interface EmailStepProps {
  isPending: boolean;
  onSubmit: (email: string) => void;
}

/** Step 1: ask for the account email and request an OTP. */
export function EmailStep({ isPending, onSubmit }: EmailStepProps) {
  const { t } = useTranslation('auth');
  const schema = useMemo(() => createForgotPasswordSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void handleSubmit((values) => {
          onSubmit(values.email);
        })(event);
      }}
    >
      <p className="text-muted-foreground text-body leading-relaxed">
        {t('forgotPasswordModal.description')}
      </p>

      <Input
        id="forgot-email"
        label={t('forgotPasswordModal.emailLabel')}
        type="email"
        autoComplete="email"
        placeholder={t('forgotPasswordModal.inputPlaceholder')}
        error={errors.email?.message}
        startIcon={<Mail className="size-4" />}
        {...register('email')}
      />

      <Button type="submit" isLoading={isPending} isFullWidth className="mt-2 gap-2">
        <span>{t('forgotPasswordModal.submit')}</span>
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
    </form>
  );
}
