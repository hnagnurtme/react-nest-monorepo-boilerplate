import { useState, type BaseSyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/entities/session';
import { useCreateRole } from '@/features/roles/api/use-create-role';
import { PermissionMatrix } from '@/features/roles/components/permission-matrix';
import type { CreateRoleBody, PermissionOption } from '@/features/roles/types';
import { roleErrorMessage } from '@/features/roles/utils/error-message';
import { permissionsFromSelection, type PresetSelection } from '@/features/roles/utils/permissions';
import { useTenants } from '@/features/tenants';
import { Button, Input, PanelForm, Select, useToast } from '@/shared/ui';

const TENANT_OPTIONS_LIMIT = 100;
const MIN_NAME_LENGTH = 2;

export interface CreateRoleFormProps {
  options: readonly PermissionOption[];
  onClose: () => void;
}

export function CreateRoleForm({ options, onClose }: CreateRoleFormProps) {
  const { t } = useTranslation('roles');
  const { showToast } = useToast();
  const isPlatformActor = useAuthStore((state) => state.user?.scope === 'platform');
  const tenants = useTenants(1, TENANT_OPTIONS_LIMIT, { enabled: isPlatformActor });
  const createRole = useCreateRole();

  const [name, setName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [selection, setSelection] = useState<PresetSelection>({});
  const [nameError, setNameError] = useState<string | undefined>();
  const [tenantError, setTenantError] = useState<string | undefined>();

  const onSubmit = (event: BaseSyntheticEvent): void => {
    event.preventDefault();
    const trimmed = name.trim();
    const hasNameError = trimmed.length < MIN_NAME_LENGTH;
    const hasTenantError = isPlatformActor && tenantId === '';
    setNameError(hasNameError ? t('create.validation.nameMin') : undefined);
    setTenantError(hasTenantError ? t('create.validation.tenantRequired') : undefined);
    if (hasNameError || hasTenantError) return;

    const body: CreateRoleBody = {
      name: trimmed,
      permissions: permissionsFromSelection(options, selection),
    };
    if (isPlatformActor) body.tenantId = tenantId;

    createRole.mutate(body, {
      onSuccess: () => {
        showToast({ type: 'success', message: t('create.success') });
        onClose();
      },
      onError: (error) => {
        showToast({ type: 'error', message: roleErrorMessage(t, error, 'create.error') });
      },
    });
  };

  return (
    <PanelForm
      label={t('create.title')}
      onSubmit={onSubmit}
      actions={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" isLoading={createRole.isPending}>
            {t('create.submit')}
          </Button>
        </>
      }
    >
      <Input
        id="create-role-name"
        label={t('create.name')}
        autoComplete="off"
        value={name}
        error={nameError}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      {isPlatformActor ? (
        <Select
          id="create-role-tenant"
          label={t('create.tenant')}
          placeholder={t('create.tenantPlaceholder')}
          value={tenantId}
          error={tenantError}
          options={(tenants.data?.items ?? []).map((tenant) => ({
            value: tenant.id,
            label: tenant.name,
          }))}
          onChange={(event) => {
            setTenantId(event.target.value);
          }}
        />
      ) : null}

      <PermissionMatrix
        options={options}
        selection={selection}
        onChange={(key, preset) => {
          setSelection((previous) => ({ ...previous, [key]: preset }));
        }}
      />
    </PanelForm>
  );
}
