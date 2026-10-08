import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { PasswordField } from '@/features/auth/components/forgot-password/password-field';
import { createAcceptInvitationSchema } from '@/features/auth/schemas/accept-invitation.schema';
import type { AcceptInvitationFormValues } from '@/features/auth/types';
import { Button } from '@/shared/ui';

export interface AcceptInvitationFormProps {
  isPending: boolean;
  onSubmit: (values: AcceptInvitationFormValues) => void;
}

export function AcceptInvitationForm({ isPending, onSubmit }: AcceptInvitationFormProps) {
  const { t } = useTranslation('auth');
  const schema = useMemo(() => createAcceptInvitationSchema(t), [t]);
  const { register, handleSubmit, formState } = useForm<AcceptInvitationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
    >
      <PasswordField
        id="invitation-password"
        label={t('acceptInvitation.passwordLabel')}
        placeholder={t('acceptInvitation.passwordPlaceholder')}
        error={formState.errors.password?.message}
        registration={register('password')}
      />
      <PasswordField
        id="invitation-confirm-password"
        label={t('acceptInvitation.confirmPasswordLabel')}
        placeholder={t('acceptInvitation.confirmPasswordPlaceholder')}
        error={formState.errors.confirmPassword?.message}
        registration={register('confirmPassword')}
      />
      <Button type="submit" size="lg" isLoading={isPending} isFullWidth>
        {t('acceptInvitation.submit')}
      </Button>
    </form>
  );
}
