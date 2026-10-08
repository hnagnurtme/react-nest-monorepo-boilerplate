import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/shared/ui';

export interface SuccessStepProps {
  onGoToLogin: () => void;
}

/** Step 3: confirmation, with the only way forward being the login page. */
export function SuccessStep({ onGoToLogin }: SuccessStepProps) {
  const { t } = useTranslation('auth');

  return (
    <div className="flex flex-col items-center py-4 text-center">
      <div className="bg-primary-light text-primary rounded-pill flex size-16 items-center justify-center">
        <CheckCircle2 className="size-10" aria-hidden="true" />
      </div>
      <h4 className="text-foreground text-heading mt-4 font-bold">
        {t('forgotPasswordModal.resetSuccessTitle')}
      </h4>
      <p className="text-muted-foreground text-body mt-1.5 leading-relaxed">
        {t('forgotPasswordModal.resetSuccessDescription')}
      </p>
      <Button type="button" onClick={onGoToLogin} isFullWidth className="mt-6">
        {t('forgotPasswordModal.loginNow')}
      </Button>
    </div>
  );
}
