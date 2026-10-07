import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmailStep } from '@/features/auth/components/forgot-password/email-step';
import { ResetStep } from '@/features/auth/components/forgot-password/reset-step';
import { SuccessStep } from '@/features/auth/components/forgot-password/success-step';
import { useForgotPasswordFlow } from '@/features/auth/hooks/use-forgot-password-flow';
import { Dialog } from '@/shared/components';

export interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Mounted only while open, so closing it discards the flow state instead of
 * resetting a dozen fields by hand.
 */
export function ForgotPasswordModal({ isOpen, onClose, onSuccess }: ForgotPasswordModalProps) {
  if (!isOpen) return null;
  return <ForgotPasswordDialog onClose={onClose} onSuccess={onSuccess} />;
}

interface ForgotPasswordDialogProps {
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
}

function ForgotPasswordDialog({ onClose, onSuccess }: ForgotPasswordDialogProps) {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const flow = useForgotPasswordFlow({ onResetSuccess: onSuccess });

  const goToLogin = useCallback(() => {
    onClose();
    void navigate('/login');
  }, [navigate, onClose]);

  return (
    <Dialog
      title={t('forgotPasswordModal.title')}
      closeLabel={t('forgotPasswordModal.close')}
      onClose={onClose}
      width="sm"
      // A half-filled reset form must not be lost by a stray click on the scrim.
      closeOnOverlayClick={flow.step === 'success'}
    >
      {flow.step === 'email' ? (
        <EmailStep isPending={flow.isRequesting} onSubmit={flow.requestCode} />
      ) : null}

      {flow.step === 'otp' ? (
        <ResetStep
          email={flow.email}
          countdown={flow.countdown}
          isResending={flow.isRequesting}
          isPending={flow.isResetting}
          onResend={flow.resendCode}
          onSubmit={flow.submitReset}
        />
      ) : null}

      {flow.step === 'success' ? <SuccessStep onGoToLogin={goToLogin} /> : null}
    </Dialog>
  );
}
