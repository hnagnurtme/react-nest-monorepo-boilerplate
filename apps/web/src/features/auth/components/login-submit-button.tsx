import { ArrowRight } from 'lucide-react';
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
      isFullWidth
      isLoading={isSubmitting}
      className="mt-2"
    >
      {isSubmitting ? (
        <span>{t('form.submitting')}</span>
      ) : (
        <>
          <span>{t('form.submit')}</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </>
      )}
    </Button>
  );
}
