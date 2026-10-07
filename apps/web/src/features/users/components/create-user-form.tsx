import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/entities/session';
import { useRoles, type RoleItem } from '@/features/roles';
import { useTenants } from '@/features/tenants';
import { useCreateUser } from '@/features/users/api/use-create-user';
import { RoleChecklist } from '@/features/users/components/role-checklist';
import {
  createUserSchema,
  needsTenant,
  type CreateUserFormValues,
  type CreateUserSchemaOptions,
} from '@/features/users/schemas/create-user.schema';
import type { CreateUserBody } from '@/features/users/types';
import { Button, Input, useToast } from '@/shared/ui';

const CONFLICT_STATUS = 409;
const FORBIDDEN_STATUS = 403;
const TENANT_OPTIONS_LIMIT = 100;
const ROLE_OPTIONS_LIMIT = 100;
const SELECT_CLASS =
  'bg-card border-border focus:border-primary focus:ring-primary/20 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2';

export interface CreateUserFormProps {
  onCreated?: () => void;
  onCancel?: () => void;
}

/**
 * Build the POST body: tenantId is sent only by platform actors, and never when every
 * selected role is a platform role (a platform user has no tenant).
 */
export function buildCreateUserBody(
  values: CreateUserFormValues,
  isPlatformActor: boolean,
  scopeOf: CreateUserSchemaOptions['scopeOf'],
): CreateUserBody {
  const body: CreateUserBody = {
    fullName: values.fullName,
    email: values.email,
    password: values.password,
    roleIds: values.roleIds,
  };
  if (values.phoneNumber !== '') {
    body.phoneNumber = values.phoneNumber;
  }
  if (isPlatformActor && needsTenant(values.roleIds, scopeOf)) {
    body.tenantId = values.tenantId;
  }
  return body;
}

/** Roles a platform actor may offer for the chosen tenant (other tenants' custom roles are hidden). */
function visibleRoles(roles: readonly RoleItem[], tenantId: string): RoleItem[] {
  return roles.filter(
    (role) => role.scope === 'platform' || role.tenantId === null || role.tenantId === tenantId,
  );
}

export function CreateUserForm({ onCreated, onCancel }: CreateUserFormProps) {
  const { t } = useTranslation('users');
  const { showToast } = useToast();
  const isPlatformActor = useAuthStore((state) => state.user?.scope === 'platform');

  const rolesQuery = useRoles(1, ROLE_OPTIONS_LIMIT);
  const allRoles = useMemo(() => rolesQuery.data?.items ?? [], [rolesQuery.data]);
  const scopeOf = useCallback(
    (roleId: string) => allRoles.find((role) => role.id === roleId)?.scope,
    [allRoles],
  );
  const schema = useMemo(
    () => createUserSchema({ isPlatformActor, scopeOf, t }),
    [isPlatformActor, scopeOf, t],
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      phoneNumber: '',
      password: '',
      roleIds: [],
      tenantId: '',
    },
  });

  const roleIds = watch('roleIds');
  const tenantId = watch('tenantId');
  const roles = useMemo(
    () => (isPlatformActor ? visibleRoles(allRoles, tenantId) : allRoles),
    [allRoles, isPlatformActor, tenantId],
  );
  const showTenantSelect = isPlatformActor && needsTenant(roleIds, scopeOf);
  const tenants = useTenants(1, TENANT_OPTIONS_LIMIT, { enabled: isPlatformActor });
  const createUser = useCreateUser();

  const toggleRole = (roleId: string): void => {
    setValue(
      'roleIds',
      roleIds.includes(roleId) ? roleIds.filter((id) => id !== roleId) : [...roleIds, roleId],
      { shouldValidate: true },
    );
  };

  const onSubmit = (values: CreateUserFormValues): void => {
    const visibleIds = new Set(roles.map((role) => role.id));
    const submitted = { ...values, roleIds: values.roleIds.filter((id) => visibleIds.has(id)) };
    createUser.mutate(buildCreateUserBody(submitted, isPlatformActor, scopeOf), {
      onSuccess: () => {
        showToast({ type: 'success', message: t('create.success') });
        reset();
        onCreated?.();
      },
      onError: (error) => {
        showToast({
          type: 'error',
          message:
            error.status === CONFLICT_STATUS
              ? t('create.duplicateEmail')
              : error.status === FORBIDDEN_STATUS
                ? t('actions.rolesForbidden')
                : t('create.error'),
        });
      },
    });
  };

  return (
    <form
      aria-label={t('create.title')}
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
      noValidate
      className="border-border bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
    >
      <Input
        id="create-user-full-name"
        label={t('create.fullName')}
        autoComplete="off"
        error={errors.fullName?.message}
        {...register('fullName')}
      />
      <Input
        id="create-user-email"
        type="email"
        label={t('create.email')}
        autoComplete="off"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        id="create-user-phone"
        type="tel"
        label={t('create.phone')}
        placeholder={t('create.phonePlaceholder')}
        autoComplete="off"
        error={errors.phoneNumber?.message}
        {...register('phoneNumber')}
      />
      <Input
        id="create-user-password"
        type="password"
        label={t('create.password')}
        autoComplete="new-password"
        error={errors.password?.message}
        {...register('password')}
      />

      <fieldset className="space-y-1.5 sm:col-span-2">
        <legend className="text-foreground block text-xs font-semibold">{t('create.roles')}</legend>
        {rolesQuery.isPending ? (
          <p className="text-muted-foreground text-sm">{t('create.rolesLoading')}</p>
        ) : roles.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('create.rolesEmpty')}</p>
        ) : (
          <RoleChecklist
            idPrefix="create-user-role"
            roles={roles}
            selected={roleIds}
            onToggle={toggleRole}
          />
        )}
        {errors.roleIds?.message ? (
          <p role="alert" className="text-destructive text-xs">
            {errors.roleIds.message}
          </p>
        ) : null}
      </fieldset>

      {showTenantSelect ? (
        <div className="space-y-1.5">
          <label
            htmlFor="create-user-tenant"
            className="text-foreground block text-xs font-semibold"
          >
            {t('create.tenant')}
          </label>
          <select id="create-user-tenant" className={SELECT_CLASS} {...register('tenantId')}>
            <option value="">{t('create.tenantPlaceholder')}</option>
            {(tenants.data?.items ?? []).map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          {errors.tenantId?.message ? (
            <p role="alert" className="text-destructive text-xs">
              {errors.tenantId.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2 sm:col-span-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('create.cancel')}
          </Button>
        ) : null}
        <Button type="submit" isLoading={createUser.isPending}>
          {t('create.submit')}
        </Button>
      </div>
    </form>
  );
}
