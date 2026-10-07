import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useCreateTenant } from '@/features/tenants/api/use-create-tenant';
import { useTenants } from '@/features/tenants/api/use-tenants';
import { useUpdateTenant } from '@/features/tenants/api/use-update-tenant';
import {
  createTenantSchema,
  type CreateTenantFormValues,
} from '@/features/tenants/schemas/create-tenant.schema';
import type { Tenant } from '@/features/tenants/types';
import { useApiErrorMessage, usePageParam } from '@/shared/hooks';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Input,
  PageHeader,
  Pagination,
  useToast,
  type DataTableColumn,
} from '@/shared/ui';

const PAGE_SIZE = 20;
const CONFLICT_STATUS = 409;

export function TenantsPage() {
  const { t } = useTranslation('tenants');
  const { showToast } = useToast();
  const toMessage = useApiErrorMessage();
  const { page, goToPage } = usePageParam();

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
          message:
            error.status === CONFLICT_STATUS
              ? t('create.duplicate')
              : toMessage(error, t('create.error')),
        });
      },
    });
  };

  const toggleActive = (tenant: Tenant): void => {
    updateTenant.mutate(
      { id: tenant.id, body: { isActive: !tenant.isActive } },
      {
        onSuccess: () => {
          showToast({ type: 'success', message: t('toggle.success') });
        },
        onError: (error) => {
          showToast({ type: 'error', message: toMessage(error, t('toggle.error')) });
        },
      },
    );
  };

  const columns: readonly DataTableColumn<Tenant>[] = [
    { key: 'name', header: t('columns.name'), cell: (tenant) => tenant.name },
    { key: 'slug', header: t('columns.slug'), cell: (tenant) => tenant.slug },
    {
      key: 'status',
      header: t('columns.status'),
      cell: (tenant) => (
        <Badge tone={tenant.isActive ? 'success' : 'neutral'}>
          {tenant.isActive ? t('status.active') : t('status.inactive')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('columns.actions'),
      cell: (tenant) => (
        <Button
          size="sm"
          variant="outline"
          disabled={updateTenant.isPending}
          onClick={() => {
            toggleActive(tenant);
          }}
        >
          {tenant.isActive ? t('toggle.deactivate') : t('toggle.activate')}
        </Button>
      ),
    },
  ];

  return (
    <div className="bg-background min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          actions={
            <Link to="/" className="text-primary text-sm font-semibold hover:underline">
              {t('back')}
            </Link>
          }
        />

        <Card>
          <form
            onSubmit={(event) => {
              void handleSubmit(onSubmit)(event);
            }}
            noValidate
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
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
        </Card>

        {isPending ? <p className="text-muted-foreground text-sm">{t('loading')}</p> : null}
        {isError ? (
          <p role="alert" className="text-destructive text-sm">
            {t('error')}
          </p>
        ) : null}

        {data ? (
          <>
            <DataTable
              columns={columns}
              rows={data.items}
              rowKey={(tenant) => tenant.id}
              emptyLabel={t('empty')}
            />
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              summary={t('pagination.summary', {
                page: data.meta.page,
                totalPages: Math.max(data.meta.totalPages, 1),
                total: data.meta.total,
              })}
              previousLabel={t('pagination.previous')}
              nextLabel={t('pagination.next')}
              onPageChange={goToPage}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
