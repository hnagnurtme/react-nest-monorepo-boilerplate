import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { CanAction } from '@/features/auth';
import { usePermissionOptions, useRoles } from '@/features/roles/api/use-roles';
import { CreateRoleDialog } from '@/features/roles/components/create-role-dialog';
import { RoleEditorDialog } from '@/features/roles/components/role-editor-dialog';
import type { RoleItem } from '@/features/roles/types';
import { useDisclosure, usePageParam } from '@/shared/hooks';
import {
  Badge,
  Button,
  DataTable,
  PageHeader,
  Pagination,
  type DataTableColumn,
} from '@/shared/ui';

const PAGE_SIZE = 20;

export function RolesPage() {
  const { t } = useTranslation('roles');
  const { page, goToPage } = usePageParam();

  const { data, isPending, isError } = useRoles(page, PAGE_SIZE);
  const permissionOptions = usePermissionOptions();
  const options = permissionOptions.data ?? [];

  const createDialog = useDisclosure();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = data?.items.find((role) => role.id === editingId);

  const columns: readonly DataTableColumn<RoleItem>[] = [
    {
      key: 'name',
      header: t('columns.name'),
      cell: (role) => (
        <span className="inline-flex items-center gap-2">
          {role.name}
          {role.isSystem ? <Badge>{t('system')}</Badge> : null}
        </span>
      ),
    },
    {
      key: 'key',
      header: t('columns.key'),
      cell: (role) => <code className="text-xs">{role.key}</code>,
    },
    {
      key: 'scope',
      header: t('columns.scope'),
      cell: (role) => (role.scope === 'platform' ? t('scope.platform') : t('scope.tenant')),
    },
    {
      key: 'permissions',
      header: t('columns.permissions'),
      cell: (role) => role.permissions.length,
    },
    {
      key: 'actions',
      header: t('columns.actions'),
      cell: (role) => (
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
            <>
              <CanAction I="create" a="Role">
                <Button size="sm" onClick={createDialog.open}>
                  {t('create.open')}
                </Button>
              </CanAction>
              <Link to="/" className="text-primary text-sm font-semibold hover:underline">
                {t('back')}
              </Link>
            </>
          }
        />

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
              rowKey={(role) => role.id}
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
    </div>
  );
}
