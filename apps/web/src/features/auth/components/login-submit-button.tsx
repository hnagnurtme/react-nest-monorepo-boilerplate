import { ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/shared/ui';

interface LoginSubmitButtonProps {
  isSubmitting: boolean;
}

export function LoginSubmitButton({ isSubmitting }: LoginSubmitButtonProps) {
  const { t } = useTranslation('auth');

  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      disabled={isSubmitting}
      className="mt-2 w-full cursor-pointer gap-2"
    >
      {isSubmitting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('form.submitting')}</span>
        </>
      ) : (
        <>
          <span>{t('form.submit')}</span>
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </Button>
  );
}
