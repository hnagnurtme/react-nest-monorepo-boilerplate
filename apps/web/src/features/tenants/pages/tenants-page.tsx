import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { useCreateTenant } from '@/features/tenants/api/use-create-tenant';
import { useTenants } from '@/features/tenants/api/use-tenants';
import { useUpdateTenant } from '@/features/tenants/api/use-update-tenant';
import {
  createTenantSchema,
  type CreateTenantFormValues,
} from '@/features/tenants/schemas/create-tenant.schema';
import { Button, Input, useToast } from '@/shared/ui';

const DEFAULT_PAGE = 1;
const PAGE_SIZE = 20;
const CONFLICT_STATUS = 409;

function parsePage(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed >= DEFAULT_PAGE ? parsed : DEFAULT_PAGE;
}

export function TenantsPage() {
  const { t } = useTranslation('tenants');
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));

  const { data, isPending, isError } = useTenants(page, PAGE_SIZE);
  const createTenant = useCreateTenant();
  const updateTenant = useUpdateTenant();

  const schema = useMemo(() => createTenantSchema(t), [t]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTenantFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '' },
  });

  const onSubmit = (values: CreateTenantFormValues): void => {
    const body = values.slug === '' ? { name: values.name } : values;
    createTenant.mutate(body, {
      onSuccess: () => {
        showToast({ type: 'success', message: t('create.success') });
        reset();
      },
      onError: (error) => {
        showToast({
          type: 'error',
          message: error.status === CONFLICT_STATUS ? t('create.duplicate') : t('create.error'),
        });
      },
    });
  };

  const toggleActive = (id: string, isActive: boolean): void => {
    updateTenant.mutate(
      { id, body: { isActive: !isActive } },
      {
        onSuccess: () => {
          showToast({ type: 'success', message: t('toggle.success') });
        },
        onError: () => {
          showToast({ type: 'error', message: t('toggle.error') });
        },
      },
    );
  };

  return (
    <div className="bg-background min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
          </div>
          <Link to="/" className="text-primary text-sm font-semibold hover:underline">
            {t('back')}
          </Link>
        </div>

        <form
          onSubmit={(event) => {
            void handleSubmit(onSubmit)(event);
          }}
          noValidate
          className="border-border bg-card grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
        >
          <Input
            id="tenant-name"
            label={t('create.name')}
            autoComplete="off"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            id="tenant-slug"
            label={t('create.slug')}
            placeholder={t('create.slugPlaceholder')}
            autoComplete="off"
            error={errors.slug?.message}
            {...register('slug')}
          />
          <Button type="submit" isLoading={createTenant.isPending} className="sm:mt-5">
            {t('create.submit')}
          </Button>
        </form>

        {isPending ? <p className="text-muted-foreground text-sm">{t('loading')}</p> : null}
        {isError ? (
          <p role="alert" className="text-destructive text-sm">
            {t('error')}
          </p>
        ) : null}

        {data ? (
          <>
            <div className="border-border bg-card overflow-x-auto rounded-xl border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t('columns.name')}</th>
                    <th className="px-4 py-2 font-medium">{t('columns.slug')}</th>
                    <th className="px-4 py-2 font-medium">{t('columns.status')}</th>
                    <th className="px-4 py-2 font-medium">{t('columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-muted-foreground px-4 py-6 text-center">
                        {t('empty')}
                      </td>
                    </tr>
                  ) : (
                    data.items.map((tenant) => (
                      <tr key={tenant.id} className="border-border border-t">
                        <td className="px-4 py-2">{tenant.name}</td>
                        <td className="px-4 py-2">{tenant.slug}</td>
                        <td className="px-4 py-2">
                          {tenant.isActive ? t('status.active') : t('status.inactive')}
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={updateTenant.isPending}
                            onClick={() => {
                              toggleActive(tenant.id, tenant.isActive);
                            }}
                          >
                            {tenant.isActive ? t('toggle.deactivate') : t('toggle.activate')}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {t('pagination.summary', {
                  page: data.meta.page,
                  totalPages: Math.max(data.meta.totalPages, 1),
                  total: data.meta.total,
                })}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={data.meta.page <= DEFAULT_PAGE}
                  onClick={() => {
                    setSearchParams({ page: String(data.meta.page - 1) });
                  }}
                >
                  {t('pagination.previous')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={data.meta.page >= data.meta.totalPages}
                  onClick={() => {
                    setSearchParams({ page: String(data.meta.page + 1) });
                  }}
                >
                  {t('pagination.next')}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
