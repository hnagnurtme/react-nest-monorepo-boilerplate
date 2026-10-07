import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { UserRole } from '@repo/shared-types';

import { useAuthStore } from '@/entities/session';
import { useTenants } from '@/features/tenants';
import { useCreateUser } from '@/features/users/api/use-create-user';
import {
  createUserSchema,
  type CreateUserFormValues,
} from '@/features/users/schemas/create-user.schema';
import type { CreateUserBody } from '@/features/users/types';
import { Button, Input, useToast } from '@/shared/ui';

const CONFLICT_STATUS = 409;
const TENANT_OPTIONS_LIMIT = 100;
const SELECT_CLASS =
  'bg-card border-border focus:border-primary focus:ring-primary/20 w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2';

export interface CreateUserFormProps {
  onCreated?: () => void;
  onCancel?: () => void;
}

/** Build the POST body: tenantId is sent only by platform admins and never for PLATFORM_ADMIN. */
export function buildCreateUserBody(
  values: CreateUserFormValues,
  isPlatformAdmin: boolean,
): CreateUserBody {
  const body: CreateUserBody = {
    fullName: values.fullName,
    email: values.email,
    password: values.password,
    role: values.role,
  };
  if (values.phoneNumber !== '') {
    body.phoneNumber = values.phoneNumber;
  }
  if (isPlatformAdmin && values.role !== 'PLATFORM_ADMIN') {
    body.tenantId = values.tenantId;
  }
  return body;
}

export function CreateUserForm({ onCreated, onCancel }: CreateUserFormProps) {
  const { t } = useTranslation('users');
  const { showToast } = useToast();
  const actorRole = useAuthStore((state) => state.user?.role);
  const isPlatformAdmin = actorRole === 'PLATFORM_ADMIN';

  const roles = useMemo<UserRole[]>(
    () =>
      isPlatformAdmin
        ? ['TENANT_ADMIN', 'TENANT_MEMBER', 'PLATFORM_ADMIN']
        : ['TENANT_ADMIN', 'TENANT_MEMBER'],
    [isPlatformAdmin],
  );
  const schema = useMemo(() => createUserSchema({ isPlatformAdmin, t }), [isPlatformAdmin, t]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      email: '',
      phoneNumber: '',
      password: '',
      role: 'TENANT_MEMBER',
      tenantId: '',
    },
  });

  const role = watch('role');
  const showTenantSelect = isPlatformAdmin && role !== 'PLATFORM_ADMIN';
  const tenants = useTenants(1, TENANT_OPTIONS_LIMIT, { enabled: isPlatformAdmin });
  const createUser = useCreateUser();

  const onSubmit = (values: CreateUserFormValues): void => {
    createUser.mutate(buildCreateUserBody(values, isPlatformAdmin), {
      onSuccess: () => {
        showToast({ type: 'success', message: t('create.success') });
        reset();
        onCreated?.();
      },
      onError: (error) => {
        showToast({
          type: 'error',
          message:
            error.status === CONFLICT_STATUS ? t('create.duplicateEmail') : t('create.error'),
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

      <div className="space-y-1.5">
        <label htmlFor="create-user-role" className="text-foreground block text-xs font-semibold">
          {t('create.role')}
        </label>
        <select id="create-user-role" className={SELECT_CLASS} {...register('role')}>
          {roles.map((value) => (
            <option key={value} value={value}>
              {t(`roles.${value}`)}
            </option>
          ))}
        </select>
        {errors.role?.message ? (
          <p role="alert" className="text-destructive text-xs">
            {errors.role.message}
          </p>
        ) : null}
      </div>

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
