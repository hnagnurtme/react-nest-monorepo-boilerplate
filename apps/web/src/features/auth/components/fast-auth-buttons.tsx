import { useTranslation } from 'react-i18next';

import { GoogleIcon } from '@/shared/icons';
import { Button } from '@/shared/ui';

export function FastAuthButtons() {
  const { t } = useTranslation('auth');

  return (
    <div className="space-y-4">
      {/* Divider Hoặc */}
      <div className="relative my-2 flex items-center justify-center">
        <div className="border-border w-full border-t" />
        <span className="bg-card text-muted-foreground absolute px-3 text-xs font-medium uppercase">
          {t('form.orDivider')}
        </span>
      </div>

      {/* Nút Đăng nhập Google */}
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="hover:bg-primary-subtle w-full gap-3 font-medium"
      >
        <GoogleIcon className="h-4 w-4" />
        <span>{t('form.googleAuth')}</span>
      </Button>
    </div>
  );
}
