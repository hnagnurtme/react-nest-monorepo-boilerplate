import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CanAction } from '@/features/auth';
import { usePermissionOptions, useRoles } from '@/features/roles/api/use-roles';
import { CreateRoleDialog } from '@/features/roles/components/create-role-dialog';
import { RoleEditorDialog } from '@/features/roles/components/role-editor-dialog';
import type { RoleItem } from '@/features/roles/types';
import {
  urlNumber,
  useDisclosure,
  usePageParam,
  useUrlState,
  type UrlStateSchema,
} from '@/shared/hooks';
import {
  ActionsCell,
  Badge,
  Button,
  CodeCell,
  ColumnVisibilityMenu,
  DataTable,
  EmptyState,
  ErrorState,
  NumberCell,
  PageHeader,
  PageShell,
  Pagination,
  TableToolbar,
  TextCell,
  useColumnVisibility,
  type DataTableColumn,
  type DataTableState,
} from '@/shared/ui';

const DEFAULT_PAGE_SIZE = 20;

/**
 * `GET /roles` takes neither `search` nor `sortBy`, so the only view state worth
 * keeping in the URL is the page size. No column declares `sortable`: a header
 * that cycles an arrow while the order never changes is worse than no header
 * control at all.
 */
const VIEW_SCHEMA: UrlStateSchema<{ limit: number }> = {
  limit: urlNumber(DEFAULT_PAGE_SIZE),
};

export function RolesPage() {
  const { t } = useTranslation('roles');
  const { t: tCommon } = useTranslation('common');
  const { page, goToPage } = usePageParam();

  const [view, setView] = useUrlState(VIEW_SCHEMA, { resetPageOn: ['limit'] });
  const { data, isPending, isError, isFetching, refetch } = useRoles(page, view.limit);
  const permissionOptions = usePermissionOptions();
  const options = permissionOptions.data ?? [];

  const createDialog = useDisclosure();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = data?.items.find((role) => role.id === editingId);

  const columns: readonly DataTableColumn<RoleItem>[] = [
    {
      id: 'name',
      header: t('columns.name'),
      kind: 'identity',
      hideable: false,
      cell: (role) => (
        <span className="inline-flex min-w-0 items-center gap-2">
          <TextCell value={role.name} />
          {role.isSystem ? <Badge>{t('system')}</Badge> : null}
        </span>
      ),
    },
    {
      id: 'key',
      header: t('columns.key'),
      kind: 'code',
      width: 'md',
      cell: (role) => <CodeCell value={role.key} />,
    },
    {
      id: 'scope',
      header: t('columns.scope'),
      width: 'sm',
      priority: 2,
      cell: (role) => (role.scope === 'platform' ? t('scope.platform') : t('scope.tenant')),
    },
    {
      id: 'permissions',
      header: t('columns.permissions'),
      kind: 'number',
      width: 'xs',
      cell: (role) => <NumberCell value={role.permissions.length} />,
    },
    {
      id: 'actions',
      header: t('columns.actions'),
      kind: 'actions',
      width: 'sm',
      hideable: false,
      cell: (role) => (
        <ActionsCell>
          <Button
            size="sm"
            variant="outline"
            aria-label={t('open', { name: role.name })}
            onClick={() => {
              setEditingId(role.id);
            }}
          >
            {role.isSystem ? t('view') : t('manage')}
          </Button>
        </ActionsCell>
      ),
    },
  ];

  const columnVisibility = useColumnVisibility('roles-list', columns);

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
      {/* No `title`: the app bar already shows "Roles" from the nav entry. */}
      <PageHeader
        subtitle={t('subtitle')}
        actions={
          <CanAction I="create" a="Role">
            <Button size="sm" onClick={createDialog.open}>
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
        rowKey={(role) => role.id}
        state={tableState}
        pageSize={view.limit}
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

      {createDialog.isOpen ? (
        <CanAction I="create" a="Role">
          <CreateRoleDialog options={options} onClose={createDialog.close} />
        </CanAction>
      ) : null}
      {editing ? (
        <RoleEditorDialog
          role={editing}
          options={options}
          onClose={() => {
            setEditingId(null);
          }}
        />
      ) : null}
    </PageShell>
  );
}
