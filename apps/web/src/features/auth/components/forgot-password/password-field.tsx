import { Eye, EyeOff, Lock } from 'lucide-react';
import { useState } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { IconButton, Input } from '@/shared/ui';

export interface PasswordFieldProps {
  id: string;
  label: string;
  placeholder: string;
  error?: string | undefined;
  registration: UseFormRegisterReturn;
}

/** Password input with a show/hide toggle, used for both new-password fields. */
export function PasswordField({ id, label, placeholder, error, registration }: PasswordFieldProps) {
  const { t } = useTranslation('auth');
  const [isVisible, setIsVisible] = useState(false);

  return (
    <Input
      id={id}
      label={label}
      type={isVisible ? 'text' : 'password'}
      autoComplete="new-password"
      placeholder={placeholder}
      error={error}
      startIcon={<Lock className="size-4" />}
      endAction={
        <IconButton
          size="sm"
          tabIndex={-1}
          label={isVisible ? t('form.hidePassword') : t('form.showPassword')}
          onClick={() => {
            setIsVisible((previous) => !previous);
          }}
          icon={
            isVisible ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )
          }
        />
      }
      {...registration}
    />
  );
}
