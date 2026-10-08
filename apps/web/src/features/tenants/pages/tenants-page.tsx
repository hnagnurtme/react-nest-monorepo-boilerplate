import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useCreateTenant } from '@/features/tenants/api/use-create-tenant';
import { useTenants } from '@/features/tenants/api/use-tenants';
import { useUpdateTenant } from '@/features/tenants/api/use-update-tenant';
import {
  createTenantSchema,
  type CreateTenantFormValues,
} from '@/features/tenants/schemas/create-tenant.schema';
import type { Tenant } from '@/features/tenants/types';
import {
  urlNumber,
  useApiErrorMessage,
  usePageParam,
  useUrlState,
  type UrlStateSchema,
} from '@/shared/hooks';
import {
  ActionsCell,
  Badge,
  Button,
  Card,
  CodeCell,
  ColumnVisibilityMenu,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  PageShell,
  Pagination,
  TableToolbar,
  TextCell,
  useColumnVisibility,
  useToast,
  type DataTableColumn,
  type DataTableState,
} from '@/shared/ui';

const DEFAULT_PAGE_SIZE = 20;

/**
 * `GET /tenants` takes neither `search` nor `sortBy`, so the page size is the
 * only view state worth a URL param, and no column declares `sortable`.
 */
const VIEW_SCHEMA: UrlStateSchema<{ limit: number }> = {
  limit: urlNumber(DEFAULT_PAGE_SIZE),
};
const CONFLICT_STATUS = 409;

export function TenantsPage() {
  const { t } = useTranslation('tenants');
  const { t: tCommon } = useTranslation('common');
  const { showToast } = useToast();
  const toMessage = useApiErrorMessage();
  const { page, goToPage } = usePageParam();

  const [view, setView] = useUrlState(VIEW_SCHEMA, { resetPageOn: ['limit'] });
  const { data, isPending, isError, isFetching, refetch } = useTenants(page, view.limit);
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
    {
      id: 'name',
      header: t('columns.name'),
      kind: 'identity',
      hideable: false,
      cell: (tenant) => <TextCell value={tenant.name} />,
    },
    {
      id: 'slug',
      header: t('columns.slug'),
      kind: 'code',
      width: 'md',
      cell: (tenant) => <CodeCell value={tenant.slug} />,
    },
    {
      id: 'status',
      header: t('columns.status'),
      kind: 'status',
      width: 'sm',
      cell: (tenant) => (
        <Badge tone={tenant.isActive ? 'success' : 'neutral'}>
          {tenant.isActive ? t('status.active') : t('status.inactive')}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: t('columns.actions'),
      kind: 'actions',
      width: 'sm',
      hideable: false,
      cell: (tenant) => (
        <ActionsCell>
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
        </ActionsCell>
      ),
    },
  ];

  const columnVisibility = useColumnVisibility('tenants-list', columns);

  const tableState: DataTableState = isError
    ? 'error'
    : isPending
      ? 'loading'
      : data.items.length === 0
        ? 'empty'
        : isFetching
          ? 'reloading'
          : 'ready';

  return (
    <PageShell>
      {/* No `title`: the app bar already shows "Tenants" from the nav entry. */}
      <PageHeader subtitle={t('subtitle')} />

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

      <DataTable
        caption={t('title')}
        columns={columnVisibility.visibleColumns}
        rows={data?.items ?? []}
        rowKey={(tenant) => tenant.id}
        state={tableState}
        pageSize={view.limit}
        isRowDimmed={(tenant) => !tenant.isActive}
        toolbar={
          <TableToolbar
            onReload={() => {
              void refetch();
            }}
            reloadLabel={tCommon('actions.reload')}
            isReloading={isFetching}
            columnsControl={
              <ColumnVisibilityMenu
                {...columnVisibility}
                label={tCommon('table.columns')}
                resetLabel={tCommon('table.showAllColumns')}
              />
            }
          />
        }
        footer={
          data === undefined ? undefined : (
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
              pageLabel={tCommon('pagination.page')}
              onPageChange={goToPage}
              pageSize={view.limit}
              pageSizeLabel={tCommon('pagination.rowsPerPage')}
              onPageSizeChange={(limit) => {
                setView({ limit });
              }}
            />
          )
        }
        emptyState={<EmptyState isInline title={t('empty')} />}
        errorState={
          <ErrorState
            isInline
            title={t('error')}
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void refetch();
                }}
              >
                {tCommon('actions.retry')}
              </Button>
            }
          />
        }
      />
    </PageShell>
  );
}
