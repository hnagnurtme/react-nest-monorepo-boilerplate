import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/entities/session';
import { useCreateRole } from '@/features/roles/api/use-create-role';
import { PermissionMatrix } from '@/features/roles/components/permission-matrix';
import type { CreateRoleBody, PermissionOption } from '@/features/roles/types';
import { roleErrorMessage } from '@/features/roles/utils/error-message';
import { permissionsFromSelection, type PresetSelection } from '@/features/roles/utils/permissions';
import { useTenants } from '@/features/tenants';
import { Dialog } from '@/shared/components/dialog';
import { Button, Input, useToast } from '@/shared/ui';

const TENANT_OPTIONS_LIMIT = 100;
const MIN_NAME_LENGTH = 2;
const SELECT_CLASS =
  'bg-card border-border focus:border-primary focus:ring-primary/20 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2';

export interface CreateRoleDialogProps {
  options: readonly PermissionOption[];
  onClose: () => void;
}

export function CreateRoleDialog({ options, onClose }: CreateRoleDialogProps) {
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

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
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
    <Dialog title={t('create.title')} closeLabel={t('close')} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
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
          <div className="space-y-1.5">
            <label
              htmlFor="create-role-tenant"
              className="text-foreground block text-xs font-semibold"
            >
              {t('create.tenant')}
            </label>
            <select
              id="create-role-tenant"
              className={SELECT_CLASS}
              value={tenantId}
              onChange={(event) => {
                setTenantId(event.target.value);
              }}
            >
              <option value="">{t('create.tenantPlaceholder')}</option>
              {(tenants.data?.items ?? []).map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
            {tenantError ? (
              <p role="alert" className="text-destructive text-xs">
                {tenantError}
              </p>
            ) : null}
          </div>
        ) : null}

        <PermissionMatrix
          options={options}
          selection={selection}
          onChange={(key, preset) => {
            setSelection((previous) => ({ ...previous, [key]: preset }));
          }}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" isLoading={createRole.isPending}>
            {t('create.submit')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
