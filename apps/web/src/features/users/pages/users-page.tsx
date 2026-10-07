import { subject } from '@casl/ability';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuthStore } from '@/entities/session';
import { CanAction, useAbility } from '@/features/auth';
import { useDeleteUser } from '@/features/users/api/use-delete-user';
import { useUpdateUser } from '@/features/users/api/use-update-user';
import { useUsers } from '@/features/users/api/use-users';
import { CreateUserForm } from '@/features/users/components/create-user-form';
import { EditUserRolesDialog } from '@/features/users/components/edit-user-roles-dialog';
import type { UserListItem } from '@/features/users/types';
import { Button, useToast } from '@/shared/ui';

const DEFAULT_PAGE = 1;
const PAGE_SIZE = 20;

function parsePage(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed >= DEFAULT_PAGE ? parsed : DEFAULT_PAGE;
}

export function UsersPage() {
  const { t } = useTranslation('users');
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));

  const { showToast } = useToast();
  const ability = useAbility();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [isCreating, setIsCreating] = useState(false);
  const [editingRolesId, setEditingRolesId] = useState<string | null>(null);

  const { data, isPending, isError } = useUsers(page, PAGE_SIZE);
  const editingRoles = data?.items.find((user) => user.id === editingRolesId);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const toTarget = (user: UserListItem) =>
    subject('User', {
      id: user.id,
      ...(user.tenantId !== null ? { tenantId: user.tenantId } : {}),
    });

  const toggleActive = (user: UserListItem): void => {
    updateUser.mutate(
      { id: user.id, body: { isActive: !user.isActive } },
      {
        onSuccess: () => {
          showToast({ type: 'success', message: t('actions.updateSuccess') });
        },
        onError: () => {
          showToast({ type: 'error', message: t('actions.updateError') });
        },
      },
    );
  };

  const removeUser = (user: UserListItem): void => {
    if (!window.confirm(t('actions.confirmDelete', { email: user.email }))) return;
    deleteUser.mutate(user.id, {
      onSuccess: () => {
        showToast({ type: 'success', message: t('actions.deleteSuccess') });
      },
      onError: () => {
        showToast({ type: 'error', message: t('actions.deleteError') });
      },
    });
  };

  const goToPage = (nextPage: number): void => {
    setSearchParams({ page: String(nextPage) });
  };

  return (
    <div className="bg-background min-h-screen p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <CanAction I="create" a="User">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setIsCreating((previous) => !previous);
                }}
              >
                {t('create.open')}
              </Button>
            </CanAction>
            <Link to="/" className="text-primary text-sm font-semibold hover:underline">
              {t('back')}
            </Link>
          </div>
        </div>

        {isCreating ? (
          <CanAction I="create" a="User">
            <CreateUserForm
              onCreated={() => {
                setIsCreating(false);
              }}
              onCancel={() => {
                setIsCreating(false);
              }}
            />
          </CanAction>
        ) : null}

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
                    <th className="px-4 py-2 font-medium">{t('columns.fullName')}</th>
                    <th className="px-4 py-2 font-medium">{t('columns.email')}</th>
                    <th className="px-4 py-2 font-medium">{t('columns.role')}</th>
                    <th className="px-4 py-2 font-medium">{t('columns.status')}</th>
                    <th className="px-4 py-2 font-medium">{t('columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground px-4 py-6 text-center">
                        {t('empty')}
                      </td>
                    </tr>
                  ) : (
                    data.items.map((user) => (
                      <tr key={user.id} className="border-border border-t">
                        <td className="px-4 py-2">{user.fullName}</td>
                        <td className="px-4 py-2">{user.email}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {user.roles.map((role) => (
                              <span
                                key={role.id}
                                className="bg-muted text-foreground rounded-full px-2 py-0.5 text-xs"
                              >
                                {role.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          {user.isActive ? t('status.active') : t('status.inactive')}
                        </td>
                        <td className="px-4 py-2">
                          {user.id !== currentUserId && ability.can('update', toTarget(user)) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingRolesId(user.id);
                              }}
                            >
                              {t('actions.editRoles')}
                            </Button>
                          ) : null}{' '}
                          {user.id !== currentUserId && ability.can('update', toTarget(user)) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={updateUser.isPending}
                              onClick={() => {
                                toggleActive(user);
                              }}
                            >
                              {user.isActive ? t('actions.deactivate') : t('actions.activate')}
                            </Button>
                          ) : null}{' '}
                          {user.id !== currentUserId && ability.can('delete', toTarget(user)) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={deleteUser.isPending}
                              onClick={() => {
                                removeUser(user);
                              }}
                            >
                              {t('actions.delete')}
                            </Button>
                          ) : null}
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
                    goToPage(data.meta.page - 1);
                  }}
                >
                  {t('pagination.previous')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={data.meta.page >= data.meta.totalPages}
                  onClick={() => {
                    goToPage(data.meta.page + 1);
                  }}
                >
                  {t('pagination.next')}
                </Button>
              </div>
            </div>
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
    </div>
  );
}
