import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useRoles } from '@/features/roles';
import { useSetUserRoles } from '@/features/users/api/use-set-user-roles';
import { RoleChecklist } from '@/features/users/components/role-checklist';
import type { UserListItem } from '@/features/users/types';
import { Dialog } from '@/shared/components/dialog';
import { Button, useToast } from '@/shared/ui';

const ROLE_OPTIONS_LIMIT = 100;
const FORBIDDEN_STATUS = 403;

export interface EditUserRolesDialogProps {
  user: UserListItem;
  onClose: () => void;
}

export function EditUserRolesDialog({ user, onClose }: EditUserRolesDialogProps) {
  const { t } = useTranslation('users');
  const { showToast } = useToast();
  const rolesQuery = useRoles(1, ROLE_OPTIONS_LIMIT);
  const setUserRoles = useSetUserRoles();
  const [selected, setSelected] = useState<string[]>(() => user.roles.map((role) => role.id));

  // A platform user (no tenant) gets platform roles; a tenant user gets tenant-scope roles
  // that are shared or belong to their own tenant.
  const assignable = useMemo(
    () =>
      (rolesQuery.data?.items ?? []).filter((role) =>
        user.tenantId === null
          ? role.scope === 'platform'
          : role.scope === 'tenant' && (role.tenantId === null || role.tenantId === user.tenantId),
      ),
    [rolesQuery.data, user.tenantId],
  );

  const toggle = (roleId: string): void => {
    setSelected((previous) =>
      previous.includes(roleId) ? previous.filter((id) => id !== roleId) : [...previous, roleId],
    );
  };

  const save = (): void => {
    setUserRoles.mutate(
      { id: user.id, body: { roleIds: selected } },
      {
        onSuccess: () => {
          showToast({ type: 'success', message: t('actions.rolesSuccess') });
          onClose();
        },
        onError: (error) => {
          showToast({
            type: 'error',
            message:
              error.status === FORBIDDEN_STATUS
                ? t('actions.rolesForbidden')
                : t('actions.rolesError'),
          });
        },
      },
    );
  };

  return (
    <Dialog
      title={t('rolesDialog.title', { email: user.email })}
      closeLabel={t('rolesDialog.cancel')}
      onClose={onClose}
    >
      {rolesQuery.isPending ? (
        <p className="text-muted-foreground text-sm">{t('rolesDialog.loading')}</p>
      ) : assignable.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('create.rolesEmpty')}</p>
      ) : (
        <RoleChecklist
          idPrefix="edit-user-role"
          roles={assignable}
          selected={selected}
          onToggle={toggle}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('rolesDialog.cancel')}
        </Button>
        <Button
          type="button"
          isLoading={setUserRoles.isPending}
          disabled={selected.length === 0}
          onClick={save}
        >
          {t('rolesDialog.save')}
        </Button>
      </div>
    </Dialog>
  );
}
