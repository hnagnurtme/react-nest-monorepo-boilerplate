import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/entities/session';
import { useRoles, type RoleItem } from '@/features/roles';
import { useTenants } from '@/features/tenants';
import { useCreateUser } from '@/features/users/api/use-create-user';
import { useInviteToTenant } from '@/features/users/api/use-tenant-invitations';
import { RoleChecklist } from '@/features/users/components/role-checklist';
import {
  createUserSchema,
  needsTenant,
  type CreateUserFormValues,
  type CreateUserSchemaOptions,
} from '@/features/users/schemas/create-user.schema';
import type { CreateUserBody, InviteToTenantBody } from '@/features/users/types';
import { Alert, Button, CheckboxField, FieldError, Input, Select, useToast } from '@/shared/ui';

const CONFLICT_STATUS = 409;
const FORBIDDEN_STATUS = 403;
/**
 * An email is one account across every tenant, so a duplicate is not a mistake
 * to correct — it is an existing account to invite into this tenant.
 */
const ACCOUNT_EXISTS_CODE = 'ACCOUNT_ALREADY_EXISTS';
const TENANT_OPTIONS_LIMIT = 100;
const ROLE_OPTIONS_LIMIT = 100;

export interface CreateUserFormProps {
  onCreated?: () => void;
  onCancel?: () => void;
}

/**
 * Build the POST body: tenantId is sent only by platform actors, and never when every
 * selected role is a platform role (a platform user has no tenant). Omitting
 * `password` is what makes the API send an invitation email instead.
 */
export function buildCreateUserBody(
  values: CreateUserFormValues,
  isPlatformActor: boolean,
  scopeOf: CreateUserSchemaOptions['scopeOf'],
): CreateUserBody {
  const body: CreateUserBody = {
    fullName: values.fullName,
    email: values.email,
    roleIds: values.roleIds,
  };
  if (!values.sendInvitation) {
    body.password = values.password;
  }
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
      sendInvitation: true,
    },
  });

  const roleIds = watch('roleIds');
  const sendInvitation = watch('sendInvitation');
  const tenantId = watch('tenantId');
  const roles = useMemo(
    () => (isPlatformActor ? visibleRoles(allRoles, tenantId) : allRoles),
    [allRoles, isPlatformActor, tenantId],
  );
  const showTenantSelect = isPlatformActor && needsTenant(roleIds, scopeOf);
  const tenants = useTenants(1, TENANT_OPTIONS_LIMIT, { enabled: isPlatformActor });
  const createUser = useCreateUser();
  const inviteToTenant = useInviteToTenant();
  // Set when the API reports the email already has an account: the form then
  // offers to invite it here instead of asking for a different address.
  const [existing, setExisting] = useState<InviteToTenantBody | null>(null);

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
    const body = buildCreateUserBody(submitted, isPlatformActor, scopeOf);
    setExisting(null);

    createUser.mutate(body, {
      onSuccess: () => {
        showToast({
          type: 'success',
          message: submitted.sendInvitation ? t('create.invitationSent') : t('create.success'),
        });
        reset();
        onCreated?.();
      },
      onError: (error) => {
        if (error.code === ACCOUNT_EXISTS_CODE) {
          setExisting({
            email: body.email,
            roleIds: body.roleIds,
            ...(body.tenantId === undefined ? {} : { tenantId: body.tenantId }),
          });
          return;
        }

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

  const onInvite = (): void => {
    if (existing === null) return;

    inviteToTenant.mutate(existing, {
      onSuccess: () => {
        showToast({ type: 'success', message: t('invite.sent', { email: existing.email }) });
        setExisting(null);
        reset();
        onCreated?.();
      },
      onError: (error) => {
        showToast({
          type: 'error',
          message:
            error.status === CONFLICT_STATUS
              ? t('invite.alreadyMember')
              : error.status === FORBIDDEN_STATUS
                ? t('actions.rolesForbidden')
                : t('invite.error'),
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
      className="border-border bg-card rounded-surface grid gap-3 border p-4 sm:grid-cols-2"
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
      {sendInvitation ? null : (
        <Input
          id="create-user-password"
          type="password"
          label={t('create.password')}
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
      )}

      <div className="sm:col-span-2">
        <CheckboxField
          id="create-user-send-invitation"
          label={t('create.sendInvitation')}
          {...register('sendInvitation')}
        />
        <p className="text-muted-foreground text-label mt-1">
          {sendInvitation ? t('create.sendInvitationHint') : t('create.manualPasswordHint')}
        </p>
      </div>

      <fieldset className="space-y-1.5 sm:col-span-2">
        <legend className="text-foreground text-label block font-semibold">
          {t('create.roles')}
        </legend>
        {rolesQuery.isPending ? (
          <p className="text-muted-foreground text-body">{t('create.rolesLoading')}</p>
        ) : roles.length === 0 ? (
          <p className="text-muted-foreground text-body">{t('create.rolesEmpty')}</p>
        ) : (
          <RoleChecklist
            idPrefix="create-user-role"
            roles={roles}
            selected={roleIds}
            onToggle={toggleRole}
          />
        )}
        {errors.roleIds?.message === undefined ? null : (
          <FieldError>{errors.roleIds.message}</FieldError>
        )}
      </fieldset>

      {showTenantSelect ? (
        <Select
          id="create-user-tenant"
          label={t('create.tenant')}
          placeholder={t('create.tenantPlaceholder')}
          error={errors.tenantId?.message}
          options={(tenants.data?.items ?? []).map((tenant) => ({
            value: tenant.id,
            label: tenant.name,
          }))}
          {...register('tenantId')}
        />
      ) : null}

      {existing === null ? null : (
        <Alert className="sm:col-span-2">
          <p className="text-body">{t('invite.prompt', { email: existing.email })}</p>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" isLoading={inviteToTenant.isPending} onClick={onInvite}>
              {t('invite.submit')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setExisting(null);
              }}
            >
              {t('invite.dismiss')}
            </Button>
          </div>
        </Alert>
      )}

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
