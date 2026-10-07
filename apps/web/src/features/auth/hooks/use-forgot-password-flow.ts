import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useForgotPassword } from '@/features/auth/api/use-forgot-password';
import { useResetPassword } from '@/features/auth/api/use-reset-password';
import type { ResetPasswordFormValues } from '@/features/auth/types';
import { useToast } from '@/shared/ui';

export type ForgotPasswordStep = 'email' | 'otp' | 'success';

export const RESEND_COOLDOWN_SECONDS = 60;
const ONE_SECOND_MS = 1000;

export interface ForgotPasswordFlow {
  step: ForgotPasswordStep;
  email: string;
  /** Seconds left before "resend code" becomes available again. */
  countdown: number;
  isRequesting: boolean;
  isResetting: boolean;
  requestCode: (email: string) => void;
  resendCode: () => void;
  submitReset: (values: ResetPasswordFormValues) => void;
  restart: () => void;
}

export interface ForgotPasswordFlowOptions {
  onResetSuccess?: (() => void) | undefined;
}

/**
 * The three-step reset flow (request a code, set a new password, done) with its
 * resend cooldown. Keeping it out of the modal lets each step stay a plain form
 * and makes the transitions readable in one place.
 */
export function useForgotPasswordFlow(options: ForgotPasswordFlowOptions = {}): ForgotPasswordFlow {
  const { onResetSuccess } = options;
  const { t } = useTranslation('auth');
  const { showToast } = useToast();

  const [step, setStep] = useState<ForgotPasswordStep>('email');
  const [email, setEmail] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN_SECONDS);

  const forgotPassword = useForgotPassword();
  const resetPassword = useResetPassword();

  useEffect(() => {
    if (step !== 'otp' || countdown <= 0) return undefined;
    const timer = setTimeout(() => {
      setCountdown((previous) => Math.max(previous - 1, 0));
    }, ONE_SECOND_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [step, countdown]);

  const requestCode = useCallback(
    (nextEmail: string) => {
      const trimmed = nextEmail.trim();
      forgotPassword.mutate(
        { email: trimmed },
        {
          onSuccess: () => {
            showToast({ type: 'success', message: t('forgotPasswordModal.codeSent') });
            setEmail(trimmed);
            setStep('otp');
            setCountdown(RESEND_COOLDOWN_SECONDS);
          },
          onError: (error) => {
            showToast({
              type: 'error',
              message: error.message || t('forgotPasswordModal.notFound'),
            });
          },
        },
      );
    },
    [forgotPassword, showToast, t],
  );

  const resendCode = useCallback(() => {
    if (countdown > 0 || forgotPassword.isPending) return;
    forgotPassword.mutate(
      { email },
      {
        onSuccess: () => {
          showToast({ type: 'success', message: t('forgotPasswordModal.resendSuccess') });
          setCountdown(RESEND_COOLDOWN_SECONDS);
        },
        onError: (error) => {
          showToast({
            type: 'error',
            message: error.message || t('forgotPasswordModal.resendFailed'),
          });
        },
      },
    );
  }, [countdown, email, forgotPassword, showToast, t]);

  const submitReset = useCallback(
    (values: ResetPasswordFormValues) => {
      resetPassword.mutate(
        { email, otp: values.otp.trim(), newPassword: values.newPassword },
        {
          onSuccess: () => {
            showToast({
              type: 'success',
              message: t('forgotPasswordModal.resetSuccessTitle'),
            });
            onResetSuccess?.();
            setStep('success');
          },
          onError: (error) => {
            showToast({
              type: 'error',
              message: error.message || t('forgotPasswordModal.resetFailed'),
            });
          },
        },
      );
    },
    [email, onResetSuccess, resetPassword, showToast, t],
  );

  const restart = useCallback(() => {
    setStep('email');
    setEmail('');
    setCountdown(RESEND_COOLDOWN_SECONDS);
  }, []);

  return {
    step,
    email,
    countdown,
    isRequesting: forgotPassword.isPending,
    isResetting: resetPassword.isPending,
    requestCode,
    resendCode,
    submitReset,
    restart,
  };
}
