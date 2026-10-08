import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Clock, KeyRound } from 'lucide-react';
import { useMemo, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { createResetPasswordSchema } from '@/features/auth/schemas/forgot-password.schema';
import type { ResetPasswordFormValues } from '@/features/auth/types';
import { Alert, Button, Input, LinkButton } from '@/shared/ui';

import { PasswordField } from './password-field';

const OTP_LENGTH = 6;
const DIGITS_ONLY = /\D/g;

export interface ResetStepProps {
  email: string;
  countdown: number;
  isResending: boolean;
  isPending: boolean;
  onResend: () => void;
  onSubmit: (values: ResetPasswordFormValues) => void;
}

/** Step 2: enter the OTP and the new password, with a resend cooldown. */
export function ResetStep({
  email,
  countdown,
  isResending,
  isPending,
  onResend,
  onSubmit,
}: ResetStepProps) {
  const { t } = useTranslation('auth');
  const schema = useMemo(() => createResetPasswordSchema(t), [t]);
  const { register, handleSubmit, setValue, formState } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(schema),
    // The email is carried by the flow, not typed again; it still goes through
    // the same schema so one definition validates the whole payload.
    defaultValues: { email, otp: '', newPassword: '', confirmPassword: '' },
  });
  const { errors } = formState;

  const otpRegistration = register('otp');

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
    >
      <Alert tone="success">
        <p className="leading-relaxed">
          {t('forgotPasswordModal.codeSentTo')} <strong className="font-semibold">{email}</strong>
        </p>
      </Alert>

      <Input
        id="reset-otp"
        label={t('forgotPasswordModal.otpLabel')}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        placeholder={t('forgotPasswordModal.otpInputPlaceholder')}
        error={errors.otp?.message}
        startIcon={<KeyRound className="size-4" />}
        className="font-semibold tracking-widest"
        {...otpRegistration}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          void otpRegistration.onChange(event);
          // Keep the field digits-only so a pasted code with spaces still works.
          setValue('otp', event.target.value.replace(DIGITS_ONLY, '').slice(0, OTP_LENGTH));
        }}
      />

      <PasswordField
        id="reset-new-password"
        label={t('forgotPasswordModal.newPasswordLabel')}
        placeholder={t('forgotPasswordModal.newPasswordPlaceholder')}
        error={errors.newPassword?.message}
        registration={register('newPassword')}
      />

      <PasswordField
        id="reset-confirm-password"
        label={t('forgotPasswordModal.confirmPasswordLabel')}
        placeholder={t('forgotPasswordModal.retypePasswordPlaceholder')}
        error={errors.confirmPassword?.message}
        registration={register('confirmPassword')}
      />

      <div className="text-muted-foreground text-body flex items-center justify-center">
        {countdown > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden="true" />
            <span>
              {t('forgotPasswordModal.resendAfter')}{' '}
              <strong className="text-foreground font-semibold">{countdown}s</strong>
            </span>
          </span>
        ) : (
          <span>
            {t('forgotPasswordModal.resendPrompt')}{' '}
            <LinkButton onClick={onResend} disabled={isResending}>
              {isResending ? t('forgotPasswordModal.resending') : t('forgotPasswordModal.resend')}
            </LinkButton>
          </span>
        )}
      </div>

      <Button type="submit" isLoading={isPending} isFullWidth className="mt-2 gap-2">
        <span>{t('forgotPasswordModal.resetSubmit')}</span>
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
    </form>
  );
}
