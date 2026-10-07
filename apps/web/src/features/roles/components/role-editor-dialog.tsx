import { useMemo, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useAbility } from '@/features/auth';
import { useDeleteRole } from '@/features/roles/api/use-delete-role';
import { useRole } from '@/features/roles/api/use-roles';
import { useSetRolePermissions } from '@/features/roles/api/use-set-role-permissions';
import { useUpdateRole } from '@/features/roles/api/use-update-role';
import { PermissionMatrix } from '@/features/roles/components/permission-matrix';
import type { PermissionOption, RoleItem } from '@/features/roles/types';
import { roleErrorMessage } from '@/features/roles/utils/error-message';
import {
  mergeOptions,
  permissionsFromSelection,
  selectionFromPermissions,
  toRoleSubject,
  type PresetSelection,
} from '@/features/roles/utils/permissions';
import { ConfirmDialog, Dialog } from '@/shared/components';
import { Button, Input, useToast } from '@/shared/ui';

const MIN_NAME_LENGTH = 2;

export interface RoleEditorDialogProps {
  role: RoleItem;
  options: readonly PermissionOption[];
  onClose: () => void;
}

/** Loads the fresh role, then renders the editor (state is initialised from it once). */
export function RoleEditorDialog({ role, options, onClose }: RoleEditorDialogProps) {
  const { t } = useTranslation('roles');
  const detail = useRole(role.id);

  return (
    <Dialog
      title={t('editor.title', { name: role.name })}
      closeLabel={t('close')}
      onClose={onClose}
    >
      {detail.data ? (
        <RoleEditorBody role={detail.data} options={options} onClose={onClose} />
      ) : (
        <p className="text-muted-foreground text-sm">
          {detail.isError ? t('editor.loadError') : t('loading')}
        </p>
      )}
    </Dialog>
  );
}

interface RoleEditorBodyProps extends RoleEditorDialogProps {
  role: RoleItem;
}

function RoleEditorBody({ role, options, onClose }: RoleEditorBodyProps) {
  const { t } = useTranslation('roles');
  const { t: tCommon } = useTranslation('common');
  const { showToast } = useToast();
  const ability = useAbility();
  const updateRole = useUpdateRole();
  const setPermissions = useSetRolePermissions();
  const deleteRole = useDeleteRole();

  const [name, setName] = useState(role.name);
  const [nameError, setNameError] = useState<string | undefined>();
  const [selection, setSelection] = useState<PresetSelection>(() =>
    selectionFromPermissions(role.permissions),
  );
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const rows = useMemo(() => mergeOptions(options, role.permissions), [options, role.permissions]);
  // System roles are immutable; the ability enforces it too, this keeps the intent explicit.
  const target = toRoleSubject(role);
  const canUpdate = !role.isSystem && ability.can('update', target);
  const canDelete = !role.isSystem && ability.can('delete', target);

  const onRename = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < MIN_NAME_LENGTH) {
      setNameError(t('create.validation.nameMin'));
      return;
    }
    setNameError(undefined);
    updateRole.mutate(
      { id: role.id, body: { name: trimmed } },
      {
        onSuccess: () => {
          showToast({ type: 'success', message: t('editor.renameSuccess') });
        },
        onError: (error) => {
          showToast({ type: 'error', message: roleErrorMessage(t, error, 'editor.renameError') });
        },
      },
    );
  };

  const onSavePermissions = (): void => {
    setPermissions.mutate(
      { id: role.id, body: { permissions: permissionsFromSelection(rows, selection) } },
      {
        onSuccess: () => {
          showToast({ type: 'success', message: t('editor.saveSuccess') });
        },
        onError: (error) => {
          showToast({ type: 'error', message: roleErrorMessage(t, error, 'editor.saveError') });
        },
      },
    );
  };

  const onDelete = (): void => {
    deleteRole.mutate(role.id, {
      onSuccess: () => {
        showToast({ type: 'success', message: t('editor.deleteSuccess') });
        setIsConfirmingDelete(false);
        onClose();
      },
      onError: (error) => {
        showToast({ type: 'error', message: roleErrorMessage(t, error, 'editor.deleteError') });
        setIsConfirmingDelete(false);
      },
    });
  };

  return (
    <div className="space-y-4">
      {role.isSystem ? (
        <p className="bg-muted text-muted-foreground rounded-lg px-3 py-2 text-xs">
          {t('editor.systemNotice')}
        </p>
      ) : null}

      {canUpdate ? (
        <form onSubmit={onRename} noValidate className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              id="role-name"
              label={t('editor.name')}
              autoComplete="off"
              value={name}
              error={nameError}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>
          <Button type="submit" variant="outline" isLoading={updateRole.isPending}>
            {t('editor.rename')}
          </Button>
        </form>
      ) : null}

      <PermissionMatrix
        options={rows}
        selection={selection}
        disabled={!canUpdate}
        onChange={(key, preset) => {
          setSelection((previous) => ({ ...previous, [key]: preset }));
        }}
      />

      <div className="flex justify-between gap-2">
        <div>
          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              isLoading={deleteRole.isPending}
              onClick={() => {
                setIsConfirmingDelete(true);
              }}
            >
              {t('editor.delete')}
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
          {canUpdate ? (
            <Button type="button" isLoading={setPermissions.isPending} onClick={onSavePermissions}>
              {t('editor.save')}
            </Button>
          ) : null}
        </div>
      </div>

      {isConfirmingDelete ? (
        <ConfirmDialog
          title={t('editor.confirmDeleteTitle')}
          message={t('editor.confirmDelete', { name: role.name })}
          confirmLabel={tCommon('actions.confirm')}
          cancelLabel={tCommon('actions.cancel')}
          closeLabel={tCommon('actions.close')}
          isPending={deleteRole.isPending}
          onConfirm={onDelete}
          onCancel={() => {
            setIsConfirmingDelete(false);
          }}
        />
      ) : null}
    </div>
  );
}
