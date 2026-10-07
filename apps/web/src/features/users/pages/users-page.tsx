import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { useUsers } from '@/features/users/api/use-users';
import { Button } from '@/shared/ui';

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

  const { data, isPending, isError } = useUsers(page, PAGE_SIZE);

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
          <Link to="/" className="text-primary text-sm font-semibold hover:underline">
            {t('back')}
          </Link>
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
                    <th className="px-4 py-2 font-medium">{t('columns.fullName')}</th>
                    <th className="px-4 py-2 font-medium">{t('columns.email')}</th>
                    <th className="px-4 py-2 font-medium">{t('columns.role')}</th>
                    <th className="px-4 py-2 font-medium">{t('columns.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-muted-foreground px-4 py-6 text-center">
                        {t('empty')}
                      </td>
                    </tr>
                  ) : (
                    data.items.map((user) => (
                      <tr key={user.id} className="border-border border-t">
                        <td className="px-4 py-2">{user.fullName}</td>
                        <td className="px-4 py-2">{user.email}</td>
                        <td className="px-4 py-2">{user.role}</td>
                        <td className="px-4 py-2">
                          {user.isActive === false ? t('status.inactive') : t('status.active')}
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
    </div>
  );
}
