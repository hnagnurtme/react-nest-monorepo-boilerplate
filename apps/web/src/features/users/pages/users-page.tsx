import { subject } from '@casl/ability';
import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useAuthStore } from '@/entities/session';
import { CanAction, useAbility } from '@/features/auth';
import { useDeleteUser } from '@/features/users/api/use-delete-user';
import { useUpdateUser } from '@/features/users/api/use-update-user';
import { useUsers } from '@/features/users/api/use-users';
import { CreateUserForm } from '@/features/users/components/create-user-form';
import { EditUserRolesDialog } from '@/features/users/components/edit-user-roles-dialog';
import type { UserListItem } from '@/features/users/types';
import { ConfirmDialog } from '@/shared/components';
import {
  useApiErrorMessage,
  useDebouncedSearchParam,
  useDisclosure,
  useFormatters,
  usePageParam,
} from '@/shared/hooks';
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

export function UsersPage() {
  const { t } = useTranslation('users');
  const { t: tCommon } = useTranslation('common');
  const { page, goToPage } = usePageParam();
  const search = useDebouncedSearchParam();

  const { showToast } = useToast();
  const toMessage = useApiErrorMessage();
  const format = useFormatters();
  const ability = useAbility();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const createForm = useDisclosure();
  const [editingRolesId, setEditingRolesId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserListItem | null>(null);

  const { data, isPending, isError, isFetching } = useUsers(page, PAGE_SIZE, search.value);
  const editingRoles = data?.items.find((user) => user.id === editingRolesId);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  /** CASL needs the loaded record: a string subject would ignore every condition. */
  const toTarget = (user: UserListItem) =>
    subject('User', {
      id: user.id,
      ...(user.tenantId !== null ? { tenantId: user.tenantId } : {}),
    });

  // Nobody edits or deletes their own account from this list.
  const isSelf = (user: UserListItem): boolean => user.id === currentUserId;
  const canUpdate = (user: UserListItem): boolean =>
    !isSelf(user) && ability.can('update', toTarget(user));
  const canDelete = (user: UserListItem): boolean =>
    !isSelf(user) && ability.can('delete', toTarget(user));

  const toggleActive = (user: UserListItem): void => {
    updateUser.mutate(
      { id: user.id, body: { isActive: !user.isActive } },
      {
        onSuccess: () => {
          showToast({ type: 'success', message: t('actions.updateSuccess') });
        },
        onError: (error) => {
          showToast({ type: 'error', message: toMessage(error, t('actions.updateError')) });
        },
      },
    );
  };

  const confirmDelete = (): void => {
    if (!pendingDelete) return;
    deleteUser.mutate(pendingDelete.id, {
      onSuccess: () => {
        showToast({ type: 'success', message: t('actions.deleteSuccess') });
        setPendingDelete(null);
      },
      onError: (error) => {
        showToast({ type: 'error', message: toMessage(error, t('actions.deleteError')) });
        setPendingDelete(null);
      },
    });
  };

  const columns: readonly DataTableColumn<UserListItem>[] = [
    { key: 'fullName', header: t('columns.fullName'), cell: (user) => user.fullName },
    { key: 'email', header: t('columns.email'), cell: (user) => user.email },
    {
      key: 'roles',
      header: t('columns.role'),
      cell: (user) => (
        <div className="flex flex-wrap gap-1">
          {user.roles.map((role) => (
            <Badge key={role.id}>{role.name}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: t('columns.createdAt'),
      cell: (user) => format.date(user.createdAt),
    },
    {
      key: 'status',
      header: t('columns.status'),
      cell: (user) => (
        <Badge tone={user.isActive ? 'success' : 'neutral'}>
          {user.isActive ? t('status.active') : t('status.inactive')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('columns.actions'),
      cell: (user) => (
        <div className="flex flex-wrap gap-2">
          {canUpdate(user) ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingRolesId(user.id);
                }}
              >
                {t('actions.editRoles')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={updateUser.isPending}
                onClick={() => {
                  toggleActive(user);
                }}
              >
                {user.isActive ? t('actions.deactivate') : t('actions.activate')}
              </Button>
            </>
          ) : null}
          {canDelete(user) ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={deleteUser.isPending}
              onClick={() => {
                setPendingDelete(user);
              }}
            >
              {t('actions.delete')}
            </Button>
          ) : null}
        </div>
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
              <CanAction I="create" a="User">
                <Button size="sm" onClick={createForm.toggle}>
                  {t('create.open')}
                </Button>
              </CanAction>
              <Link to="/" className="text-primary text-sm font-semibold hover:underline">
                {t('back')}
              </Link>
            </>
          }
        />

        <Card>
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <Input
              id="users-search"
              type="search"
              autoComplete="off"
              aria-label={t('search.label')}
              placeholder={t('search.placeholder')}
              value={search.inputValue}
              onChange={(event) => {
                search.setInputValue(event.target.value);
              }}
              className="h-11 pl-10 pr-10"
            />
            {search.inputValue === '' ? null : (
              <button
                type="button"
                aria-label={t('search.clear')}
                onClick={search.clear}
                className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </Card>

        {createForm.isOpen ? (
          <CanAction I="create" a="User">
            <CreateUserForm onCreated={createForm.close} onCancel={createForm.close} />
          </CanAction>
        ) : null}

        {isPending || isFetching ? (
          <p role="status" className="text-muted-foreground text-sm">
            {t('loading')}
          </p>
        ) : null}
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
              rowKey={(user) => user.id}
              emptyLabel={
                search.value === '' ? t('empty') : t('search.empty', { term: search.value })
              }
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

      {editingRoles ? (
        <EditUserRolesDialog
          key={editingRoles.id}
          user={editingRoles}
          onClose={() => {
            setEditingRolesId(null);
          }}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title={t('actions.confirmDeleteTitle')}
          message={t('actions.confirmDelete', { email: pendingDelete.email })}
          confirmLabel={tCommon('actions.confirm')}
          cancelLabel={tCommon('actions.cancel')}
          closeLabel={tCommon('actions.close')}
          isPending={deleteUser.isPending}
          onConfirm={confirmDelete}
          onCancel={() => {
            setPendingDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}
