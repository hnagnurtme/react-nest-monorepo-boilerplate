import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { CanAction } from '@/features/auth';
import { usePermissionOptions, useRoles } from '@/features/roles/api/use-roles';
import { CreateRoleDialog } from '@/features/roles/components/create-role-dialog';
import { RoleEditorDialog } from '@/features/roles/components/role-editor-dialog';
import { Button } from '@/shared/ui';

const DEFAULT_PAGE = 1;
const PAGE_SIZE = 20;

function parsePage(value: string | null): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed >= DEFAULT_PAGE ? parsed : DEFAULT_PAGE;
}

export function RolesPage() {
  const { t } = useTranslation('roles');
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));

  const { data, isPending, isError } = useRoles(page, PAGE_SIZE);
  const permissionOptions = usePermissionOptions();
  const options = permissionOptions.data ?? [];

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = data?.items.find((role) => role.id === editingId);

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
            <CanAction I="create" a="Role">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setIsCreating(true);
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
                    <th className="px-4 py-2 font-medium">{t('columns.name')}</th>
                    <th className="px-4 py-2 font-medium">{t('columns.key')}</th>
                    <th className="px-4 py-2 font-medium">{t('columns.scope')}</th>
                    <th className="px-4 py-2 font-medium">{t('columns.permissions')}</th>
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
                    data.items.map((role) => (
                      <tr key={role.id} className="border-border border-t">
                        <td className="px-4 py-2">
                          {role.name}{' '}
                          {role.isSystem ? (
                            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                              {t('system')}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2">
                          <code className="text-xs">{role.key}</code>
                        </td>
                        <td className="px-4 py-2">{t(`scope.${role.scope}`)}</td>
                        <td className="px-4 py-2">{role.permissions.length}</td>
                        <td className="px-4 py-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-label={t('open', { name: role.name })}
                            onClick={() => {
                              setEditingId(role.id);
                            }}
                          >
                            {role.isSystem ? t('view') : t('manage')}
                          </Button>
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

      {isCreating ? (
        <CanAction I="create" a="Role">
          <CreateRoleDialog
            options={options}
            onClose={() => {
              setIsCreating(false);
            }}
          />
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
