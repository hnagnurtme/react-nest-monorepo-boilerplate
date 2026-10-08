import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAcceptInvitation } from '@/features/auth/api/use-accept-invitation';
import { useInvitationPreview } from '@/features/auth/api/use-invitation-preview';
import { AuthHeader } from '@/features/auth/components/auth-header';
import { AcceptInvitationForm } from '@/features/auth/components/invitation/accept-invitation-form';
import type { AcceptInvitationFormValues } from '@/features/auth/types';
import { useToast } from '@/shared/ui';

/**
 * Public page reached from the invitation email. The token lives in the query
 * string only: it is never put in the session store, so closing the tab ends it.
 */
export function AcceptInvitationPage() {
  const { t } = useTranslation('auth');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation();

  const onSubmit = (values: AcceptInvitationFormValues): void => {
    accept.mutate(
      { token, password: values.password },
      {
        onSuccess: () => {
          showToast({ type: 'success', message: t('acceptInvitation.success') });
          void navigate('/login', { replace: true });
        },
        onError: () => {
          showToast({ type: 'error', message: t('acceptInvitation.error') });
        },
      },
    );
  };

  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col">
      <div className="px-6 py-6 sm:px-10">
        <AuthHeader />
      </div>

      <main className="flex flex-1 items-center justify-center px-6 pb-12">
        <div className="border-border bg-card rounded-overlay w-full max-w-md border p-6 sm:p-8">
          {preview.isPending && token !== '' ? (
            <p className="text-muted-foreground text-body">{t('acceptInvitation.loading')}</p>
          ) : preview.isError || token === '' ? (
            <div className="space-y-2">
              <h1 className="text-heading font-semibold">{t('acceptInvitation.invalidTitle')}</h1>
              <p className="text-muted-foreground text-body">{t('acceptInvitation.invalidBody')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-heading font-semibold">
                  {t('acceptInvitation.title', { tenant: preview.data?.tenantName ?? '' })}
                </h1>
                <p className="text-muted-foreground text-body">
                  {t('acceptInvitation.subtitle', { email: preview.data?.email ?? '' })}
                </p>
              </div>

              <AcceptInvitationForm isPending={accept.isPending} onSubmit={onSubmit} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
