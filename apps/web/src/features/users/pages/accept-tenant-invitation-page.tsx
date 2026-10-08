import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  useAcceptTenantInvitation,
  useTenantInvitationPreview,
} from '@/features/users/api/use-tenant-invitations';
import { Button, Card, PageShell, Stack, useToast } from '@/shared/ui';

/**
 * Public page reached from the "you were invited to join" email.
 *
 * The account already exists, so there is nothing to fill in — accepting is the
 * whole screen. It is the invitee who clicks: that consent is why a tenant
 * admin cannot simply attach a stranger by email.
 *
 * The token lives in the query string only, never in the session store, so
 * closing the tab ends it.
 */
export function AcceptTenantInvitationPage() {
  const { t } = useTranslation('users');
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const preview = useTenantInvitationPreview(token);
  const accept = useAcceptTenantInvitation();

  const onAccept = (): void => {
    accept.mutate(token, {
      onSuccess: () => {
        showToast({ type: 'success', message: t('joinTenant.success') });
        void navigate('/login', { replace: true });
      },
      onError: () => {
        showToast({ type: 'error', message: t('joinTenant.error') });
      },
    });
  };

  const isInvalid = token === '' || preview.isError;

  return (
    <PageShell width="form" isCentered>
      <Card className="p-8">
        {preview.isPending && token !== '' ? (
          <p className="text-muted-foreground text-body">{t('joinTenant.loading')}</p>
        ) : isInvalid ? (
          <Stack gap="snug">
            <h1 className="text-heading font-semibold">{t('joinTenant.invalidTitle')}</h1>
            <p className="text-muted-foreground text-body">{t('joinTenant.invalidBody')}</p>
          </Stack>
        ) : (
          <Stack gap="normal">
            <Stack gap="snug">
              <h1 className="text-heading font-semibold">
                {t('joinTenant.title', { tenant: preview.data?.tenantName ?? '' })}
              </h1>
              <p className="text-muted-foreground text-body">
                {t('joinTenant.subtitle', {
                  inviter: preview.data?.inviterName ?? '',
                  email: preview.data?.email ?? '',
                })}
              </p>
              {preview.data && preview.data.roles.length > 0 ? (
                <p className="text-muted-foreground text-caption">
                  {t('joinTenant.roles', { roles: preview.data.roles.join(', ') })}
                </p>
              ) : null}
            </Stack>

            <Button isFullWidth isLoading={accept.isPending} onClick={onAccept}>
              {t('joinTenant.accept')}
            </Button>
          </Stack>
        )}
      </Card>
    </PageShell>
  );
}
