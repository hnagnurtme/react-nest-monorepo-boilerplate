import { useMemo, useState } from 'react';
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
import { Button, ConfirmDialog, Input, PanelForm, useToast } from '@/shared/ui';

const MIN_NAME_LENGTH = 2;

export interface RoleEditorProps {
  role: RoleItem;
  options: readonly PermissionOption[];
  onClose: () => void;
}

/** Loads the fresh role, then renders the editor (state is initialised from it once). */
export function RoleEditorForm({ role, options, onClose }: RoleEditorProps) {
  const { t } = useTranslation('roles');
  const detail = useRole(role.id);

  if (!detail.data) {
    return (
      <p className="text-muted-foreground text-body p-4">
        {detail.isError ? t('editor.loadError') : t('loading')}
      </p>
    );
  }

  return <RoleEditorBody role={detail.data} options={options} onClose={onClose} />;
}

interface RoleEditorBodyProps extends RoleEditorProps {
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

  const onRename = (): void => {
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

  /*
    Saving the matrix is the panel's primary action, so the action row belongs
    to the shell rather than to the rename form inside it: the permission list
    is long, and a Save below the fold is a Save nobody presses.
  */
  return (
    <PanelForm
      label={t('editor.title', { name: role.name })}
      onSubmit={(event) => {
        event.preventDefault();
        if (canUpdate) onSavePermissions();
      }}
      leading={
        canDelete ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            isLoading={deleteRole.isPending}
            onClick={() => {
              setIsConfirmingDelete(true);
            }}
          >
            {t('editor.delete')}
          </Button>
        ) : null
      }
      actions={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
          {canUpdate ? (
            <Button type="submit" isLoading={setPermissions.isPending}>
              {t('editor.save')}
            </Button>
          ) : null}
        </>
      }
    >
      {role.isSystem ? (
        <p className="bg-muted text-muted-foreground rounded-inner text-label px-3 py-2">
          {t('editor.systemNotice')}
        </p>
      ) : null}

      {canUpdate ? (
        /* Renaming is its own request, so it keeps its own button; a nested
           form is invalid HTML, hence the div and an explicit click. */
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              id="role-name"
              label={t('editor.name')}
              isRequired
              autoComplete="off"
              value={name}
              error={nameError}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            isLoading={updateRole.isPending}
            onClick={onRename}
          >
            {t('editor.rename')}
          </Button>
        </div>
      ) : null}

      <PermissionMatrix
        options={rows}
        selection={selection}
        disabled={!canUpdate}
        onChange={(key, preset) => {
          setSelection((previous) => ({ ...previous, [key]: preset }));
        }}
      />

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
    </PanelForm>
  );
}
