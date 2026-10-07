import { Eye, EyeOff, Lock } from 'lucide-react';
import { useState } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Input } from '@/shared/ui';

import { IconField } from './icon-field';

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
    <IconField id={id} label={label} icon={<Lock className="h-4 w-4" />}>
      <Input
        id={id}
        type={isVisible ? 'text' : 'password'}
        autoComplete="new-password"
        placeholder={placeholder}
        error={error}
        className="h-11 pl-10 pr-10"
        {...registration}
      />
      <button
        type="button"
        aria-label={isVisible ? t('form.hidePassword') : t('form.showPassword')}
        onClick={() => {
          setIsVisible((previous) => !previous);
        }}
        className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3"
        tabIndex={-1}
      >
        {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </IconField>
  );
}
