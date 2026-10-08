import { MailWarning } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useAbility } from '@/features/auth';
import {
  usePendingInvitations,
  useResendInvitationToTenant,
  useRevokeInvitation,
} from '@/features/users/api/use-tenant-invitations';
import { useFormatters } from '@/shared/hooks';
import { Button, Card, Stack, useToast } from '@/shared/ui';

/**
 * Accounts that were invited into this tenant and have not accepted yet.
 *
 * Shown because an invitation is state the tenant is responsible for: without
 * a list, "did it arrive?" has no answer and a wrong address is invisible.
 */
export function PendingInvitations() {
  const { t } = useTranslation('users');
  const { showToast } = useToast();
  const format = useFormatters();
  const ability = useAbility();
  const canInvite = ability.can('create', 'User');

  const pending = usePendingInvitations({ enabled: canInvite });
  const revoke = useRevokeInvitation();
  const resend = useResendInvitationToTenant();

  const rows = pending.data ?? [];
  if (!canInvite || rows.length === 0) return null;

  return (
    <Card className="p-4">
      <Stack gap="snug">
        <p className="text-foreground text-label flex items-center gap-2 font-semibold">
          <MailWarning className="size-4" aria-hidden="true" />
          {t('pendingInvitations.title', { count: rows.length })}
        </p>

        <ul className="divide-border divide-y">
          {rows.map((invitation) => (
            <li
              key={invitation.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div>
                <p className="text-foreground text-body">{invitation.email}</p>
                <p className="text-muted-foreground text-caption">
                  {t('pendingInvitations.detail', {
                    roles: invitation.roles.join(', '),
                    expires: format.dateTime(invitation.expiresAt),
                  })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={resend.isPending}
                  onClick={() => {
                    resend.mutate(invitation.id, {
                      onSuccess: () => {
                        showToast({ type: 'success', message: t('pendingInvitations.resent') });
                      },
                      onError: () => {
                        showToast({ type: 'error', message: t('pendingInvitations.resendError') });
                      },
                    });
                  }}
                >
                  {t('pendingInvitations.resend')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  isLoading={revoke.isPending}
                  onClick={() => {
                    revoke.mutate(invitation.id, {
                      onSuccess: () => {
                        showToast({ type: 'success', message: t('pendingInvitations.revoked') });
                      },
                      onError: () => {
                        showToast({ type: 'error', message: t('pendingInvitations.revokeError') });
                      },
                    });
                  }}
                >
                  {t('pendingInvitations.revoke')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Stack>
    </Card>
  );
}
