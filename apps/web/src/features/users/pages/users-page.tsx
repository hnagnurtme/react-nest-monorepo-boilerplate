import { subject } from '@casl/ability';
import { Search, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useAuthStore } from '@/entities/session';
import { CanAction, useAbility } from '@/features/auth';
import { useDeleteUser } from '@/features/users/api/use-delete-user';
import { useResendInvitation } from '@/features/users/api/use-resend-invitation';
import { useUpdateUser } from '@/features/users/api/use-update-user';
import { useUsers } from '@/features/users/api/use-users';
import { CreateUserForm } from '@/features/users/components/create-user-form';
import { EditUserRolesDialog } from '@/features/users/components/edit-user-roles-dialog';
import { PendingInvitations } from '@/features/users/components/pending-invitations';
import type { UserListItem } from '@/features/users/types';
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
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  PageHeader,
  PageShell,
  Pagination,
  SkeletonTable,
  Stack,
  TEXT_LINK,
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

  const { data, isPending, isError, isFetching, refetch } = useUsers(page, PAGE_SIZE, search.value);
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
        <div className="flex flex-wrap gap-1">
          <Badge tone={user.isActive ? 'success' : 'neutral'}>
            {user.isActive ? t('status.active') : t('status.inactive')}
          </Badge>
          {isPendingInvite(user) ? <Badge tone="warning">{t('status.pendingInvite')}</Badge> : null}
        </div>
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
        </div>
      ),
    },
  ];

  const hasRows = data !== undefined && data.items.length > 0;
  const isSearching = search.value !== '';

  return (
    <PageShell>
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
            <Link to="/" className={TEXT_LINK}>
              {t('back')}
            </Link>
          </>
        }
      />

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
        startIcon={<Search className="size-4" />}
        endAction={
          search.inputValue === '' ? undefined : (
            <IconButton
              size="sm"
              label={t('search.clear')}
              onClick={search.clear}
              icon={<X className="size-4" aria-hidden="true" />}
            />
          )
        }
      />

      {createForm.isOpen ? (
        <CanAction I="create" a="User">
          <CreateUserForm onCreated={createForm.close} onCancel={createForm.close} />
        </CanAction>
      ) : null}

      <PendingInvitations />

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

      {/* A refetch keeps the current rows on screen; only the first load blanks it. */}
      {data !== undefined && isFetching ? (
        <p role="status" className="text-muted-foreground text-label">
          {t('loading')}
        </p>
      ) : null}

      {hasRows ? (
        <Stack gap="normal">
          <DataTable columns={columns} rows={data.items} rowKey={(user) => user.id} emptyLabel="" />
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
        </Stack>
      ) : null}

      {data !== undefined && !hasRows ? (
        // No call to action here: the header already carries "Create user", and a
        // second control with the same name is a worse page, not a better one.
        <EmptyState
          icon={<Users className="size-8" aria-hidden="true" />}
          title={isSearching ? t('search.empty', { term: search.value }) : t('empty')}
        />
      ) : null}

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
