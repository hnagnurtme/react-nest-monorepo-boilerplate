import { Pencil, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CanAction } from '@/features/auth';
import { useTenant } from '@/features/tenants/api/use-tenant';
import { useTenants } from '@/features/tenants/api/use-tenants';
import { useUpdateTenant } from '@/features/tenants/api/use-update-tenant';
import { CreateTenantForm } from '@/features/tenants/components/create-tenant-form';
import { EditTenantForm } from '@/features/tenants/components/edit-tenant-form';
import type { Tenant } from '@/features/tenants/types';
import {
  urlNumber,
  useApiErrorMessage,
  useDisclosure,
  usePageParam,
  urlString,
  useUrlState,
  type UrlStateSchema,
} from '@/shared/hooks';
import {
  ActionsCell,
  Button,
  CodeCell,
  ColumnVisibilityMenu,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  PageShell,
  Pagination,
  SidePanel,
  Spinner,
  StatusDot,
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
 * only list state worth a URL param, and no column declares `sortable`.
 *
 * `detail` is the open panel's tenant. It lives in the URL rather than in
 * component state because the home chooser links straight to one tenant's
 * details, and a reload on that link has to reopen the same panel.
 */
const VIEW_SCHEMA: UrlStateSchema<{ limit: number; detail: string }> = {
  limit: urlNumber(DEFAULT_PAGE_SIZE),
  detail: urlString(),
};
export function TenantsPage() {
  const { t } = useTranslation('tenants');
  const { t: tCommon } = useTranslation('common');
  const { showToast } = useToast();
  const toMessage = useApiErrorMessage();
  const { page, goToPage } = usePageParam();

  const [view, setView] = useUrlState(VIEW_SCHEMA, { resetPageOn: ['limit'] });
  const { data, isPending, isError, isFetching, refetch } = useTenants(page, view.limit);
  const updateTenant = useUpdateTenant();
  const createForm = useDisclosure();

  const detailId = view.detail === '' ? null : view.detail;
  /*
    The row comes from the loaded page when it is there, and from its own read
    when it is not: `detail` may name a tenant on another page of the table, or
    one the chooser linked to before any page was fetched.
  */
  const detail = useTenant(data?.items.some((t) => t.id === detailId) === true ? null : detailId);
  const editingRow = data?.items.find((t) => t.id === detailId) ?? detail.data ?? null;

  const openDetail = (id: string): void => {
    setView({ detail: id });
  };
  const closeDetail = (): void => {
    setView({ detail: '' });
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
        <StatusDot tone={tenant.isActive ? 'active' : 'inactive'}>
          {tenant.isActive ? t('status.active') : t('status.inactive')}
        </StatusDot>
      ),
    },
    {
      id: 'actions',
      header: t('columns.actions'),
      kind: 'actions',
      /* Two buttons: `md` is narrow enough that they wrap onto two lines. */
      width: 'lg',
      hideable: false,
      cell: (tenant) => (
        <ActionsCell>
          <CanAction I="update" a="Tenant">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                openDetail(tenant.id);
              }}
            >
              <Pencil aria-hidden="true" className="size-4" />
              {t('edit.open')}
            </Button>
          </CanAction>
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
      <PageHeader
        subtitle={t('subtitle')}
        actions={
          <CanAction I="create" a="Tenant">
            <Button size="sm" onClick={createForm.open}>
              <Plus aria-hidden="true" className="size-4" />
              {t('create.open')}
            </Button>
          </CanAction>
        }
      />

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

      {/*
        Docked to the right, not a block permanently above the table: a form two
        fields long does not earn a third of the page on every visit.
      */}
      {createForm.isOpen ? (
        <CanAction I="create" a="Tenant">
          <SidePanel
            title={t('create.title')}
            description={t('create.panelDescription')}
            closeLabel={tCommon('actions.close')}
            onClose={createForm.close}
            // A half-filled form must not vanish on a stray click outside it.
            closeOnOverlayClick={false}
            // The form owns the scroll: its action row stays pinned below it.
            isFlush
          >
            <CreateTenantForm
              variant="panel"
              onCreated={createForm.close}
              onCancel={createForm.close}
            />
          </SidePanel>
        </CanAction>
      ) : null}

      {detailId === null ? null : (
        <CanAction I="update" a="Tenant">
          <SidePanel
            title={t('edit.title')}
            description={t('edit.panelDescription')}
            closeLabel={tCommon('actions.close')}
            onClose={closeDetail}
            closeOnOverlayClick={false}
            isFlush
          >
            {editingRow === null ? (
              /* Linked straight to this tenant: its read is still in flight. */
              <div className="flex items-center justify-center p-8">
                <Spinner />
              </div>
            ) : (
              /* Keyed by id: switching rows must rebuild the form's defaults. */
              <EditTenantForm
                key={editingRow.id}
                tenant={editingRow}
                variant="panel"
                onSaved={closeDetail}
                onCancel={closeDetail}
              />
            )}
          </SidePanel>
        </CanAction>
      )}
    </PageShell>
  );
}
