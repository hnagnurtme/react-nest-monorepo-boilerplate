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
  ErrorState,
  PageHeader,
  PageShell,
  Pagination,
  SkeletonTable,
  TEXT_LINK,
  type DataTableColumn,
} from '@/shared/ui';

const PAGE_SIZE = 20;

export function RolesPage() {
  const { t } = useTranslation('roles');
  const { t: tCommon } = useTranslation('common');
  const { page, goToPage } = usePageParam();

  const { data, isPending, isError, refetch } = useRoles(page, PAGE_SIZE);
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
      cell: (role) => <code className="text-label">{role.key}</code>,
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
    <PageShell>
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
            <Link to="/" className={TEXT_LINK}>
              {t('back')}
            </Link>
          </>
        }
      />

      {isPending ? <SkeletonTable columns={columns.length} label={t('loading')} /> : null}
      {isError ? (
        <ErrorState
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
