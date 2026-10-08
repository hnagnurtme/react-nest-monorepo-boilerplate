import { subject } from '@casl/ability';
import { Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '@/entities/session';
import { CanAction, useAbility } from '@/features/auth';
import { useDeleteUser } from '@/features/users/api/use-delete-user';
import { useResendInvitation } from '@/features/users/api/use-resend-invitation';
import { useUpdateUser } from '@/features/users/api/use-update-user';
import { USER_SORT_FIELDS, useUsers } from '@/features/users/api/use-users';
import { CreateUserForm } from '@/features/users/components/create-user-form';
import { EditUserRolesDialog } from '@/features/users/components/edit-user-roles-dialog';
import { PendingInvitations } from '@/features/users/components/pending-invitations';
import type { UserListItem } from '@/features/users/types';
import {
  urlNumber,
  urlString,
  useApiErrorMessage,
  useDebouncedSearchParam,
  useDisclosure,
  useFormatters,
  usePageParam,
  useUrlState,
  type UrlStateSchema,
} from '@/shared/hooks';
import {
  ActionsCell,
  Badge,
  BadgeGroupCell,
  Button,
  ColumnVisibilityMenu,
  ConfirmDialog,
  DataTable,
  DateTimeCell,
  EmptyState,
  ErrorState,
  PageHeader,
  PageShell,
  Pagination,
  TableToolbar,
  TextCell,
  parseSort,
  serializeSort,
  useColumnVisibility,
  useToast,
  type DataTableColumn,
  type DataTableState,
} from '@/shared/ui';

const DEFAULT_PAGE_SIZE = 20;

/**
 * The part of the view that belongs in the URL: a sorted, paged list has to be
 * reproducible from a pasted link. `limit` is here too — "show me 100" should
 * survive a reload.
 */
const VIEW_SCHEMA: UrlStateSchema<{ sort: string; limit: number }> = {
  sort: urlString(''),
  limit: urlNumber(DEFAULT_PAGE_SIZE),
};

export function UsersPage() {
  const { t } = useTranslation('users');
  const { t: tCommon } = useTranslation('common');
  const { page, goToPage } = usePageParam();
  const search = useDebouncedSearchParam();
  const [view, setView] = useUrlState(VIEW_SCHEMA, { resetPageOn: ['sort', 'limit'] });
  // A column may only sort by a field the API allow-lists, or it 422s.
  const sort = parseSort(view.sort);
  const isSortable = (field: string): boolean =>
    (USER_SORT_FIELDS as readonly string[]).includes(field);

  const { showToast } = useToast();
  const toMessage = useApiErrorMessage();
  const format = useFormatters();
  const ability = useAbility();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const createForm = useDisclosure();
  const [editingRolesId, setEditingRolesId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserListItem | null>(null);

  const { data, isPending, isError, isFetching, refetch } = useUsers(
    page,
    view.limit,
    search.value,
    sort,
  );
  const editingRoles = data?.items.find((user) => user.id === editingRolesId);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const resendInvitation = useResendInvitation();

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
  /** An invited account stays unverified until it follows the emailed link. */
  const isPendingInvite = (user: UserListItem): boolean => !user.isEmailVerified;

  const resend = (user: UserListItem): void => {
    resendInvitation.mutate(user.id, {
      onSuccess: () => {
        showToast({ type: 'success', message: t('actions.resendSuccess', { email: user.email }) });
      },
      onError: (error) => {
        showToast({ type: 'error', message: toMessage(error, t('actions.resendError')) });
      },
    });
  };

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
    {
      id: 'fullName',
      header: t('columns.fullName'),
      kind: 'identity',
      sortable: isSortable('fullName'),
      hideable: false,
      cell: (user) => <TextCell value={user.fullName} />,
    },
    {
      id: 'email',
      header: t('columns.email'),
      sortable: isSortable('email'),
      cell: (user) => <TextCell value={user.email} />,
    },
    {
      id: 'roles',
      header: t('columns.role'),
      kind: 'badge',
      cell: (user) => (
        <BadgeGroupCell>
          {user.roles.map((role) => (
            <Badge key={role.id}>{role.name}</Badge>
          ))}
        </BadgeGroupCell>
      ),
    },
    {
      id: 'createdAt',
      header: t('columns.createdAt'),
      kind: 'datetime',
      width: 'sm',
      // Second to drop on a narrow window: it is the least load-bearing column.
      priority: 2,
      sortable: isSortable('createdAt'),
      cell: (user) => <DateTimeCell value={format.date(user.createdAt)} />,
    },
    {
      id: 'status',
      header: t('columns.status'),
      kind: 'status',
      width: 'sm',
      cell: (user) => (
        <BadgeGroupCell>
          <Badge tone={user.isActive ? 'success' : 'neutral'}>
            {user.isActive ? t('status.active') : t('status.inactive')}
          </Badge>
          {isPendingInvite(user) ? <Badge tone="warning">{t('status.pendingInvite')}</Badge> : null}
        </BadgeGroupCell>
      ),
    },
    {
      id: 'actions',
      header: t('columns.actions'),
      kind: 'actions',
      width: 'lg',
      hideable: false,
      cell: (user) => (
        <ActionsCell>
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
              {isPendingInvite(user) ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resendInvitation.isPending}
                  onClick={() => {
                    resend(user);
                  }}
                >
                  {t('actions.resendInvitation')}
                </Button>
              ) : null}
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
        </ActionsCell>
      ),
    },
  ];

  const columnVisibility = useColumnVisibility('users-list', columns);
  const isSearching = search.value !== '';

  /*
   * One expression, read top to bottom, instead of four sibling blocks each
   * guarding a different combination of flags: an error wins over a load, a
   * first load over a refetch, and an empty result only counts as "nothing here"
   * when no search narrowed it.
   */
  const tableState: DataTableState = isError
    ? 'error'
    : isPending
      ? 'loading'
      : data.items.length > 0
        ? isFetching
          ? 'reloading'
          : 'ready'
        : isSearching
          ? 'no-results'
          : 'empty';

  return (
    <PageShell>
      {/* No `title`: the app bar already shows "Users" from the nav entry. */}
      <PageHeader
        subtitle={t('subtitle')}
        actions={
          <CanAction I="create" a="User">
            <Button size="sm" onClick={createForm.toggle}>
              <Plus aria-hidden="true" className="size-4" />
              {t('create.open')}
            </Button>
          </CanAction>
        }
      />

      {createForm.isOpen ? (
        <CanAction I="create" a="User">
          <CreateUserForm onCreated={createForm.close} onCancel={createForm.close} />
        </CanAction>
      ) : null}

      <PendingInvitations />

      <DataTable
        caption={t('title')}
        columns={columnVisibility.visibleColumns}
        rows={data?.items ?? []}
        rowKey={(user) => user.id}
        state={tableState}
        pageSize={view.limit}
        sort={sort}
        onSortChange={(next) => {
          setView({ sort: serializeSort(next) });
        }}
        sortLabel={tCommon('table.sortBy')}
        toolbar={
          <TableToolbar
            searchValue={search.inputValue}
            onSearchChange={search.setInputValue}
            searchLabel={t('search.label')}
            searchPlaceholder={t('search.placeholder')}
            clearSearchLabel={t('search.clear')}
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
        // No call to action here: the header already carries "Create user", and a
        // second control with the same name is a worse page, not a better one.
        emptyState={
          <EmptyState
            isInline
            icon={<Users className="size-8" aria-hidden="true" />}
            title={t('empty')}
          />
        }
        noResultsState={
          <EmptyState
            isInline
            title={t('search.empty', { term: search.value })}
            action={
              // Not "Clear search": the toolbar's own clear button already
              // carries that name, and two buttons with one name is ambiguous
              // to anyone navigating by label.
              <Button size="sm" variant="outline" onClick={search.clear}>
                {tCommon('table.clearFilters')}
              </Button>
            }
          />
        }
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
    </PageShell>
  );
}
