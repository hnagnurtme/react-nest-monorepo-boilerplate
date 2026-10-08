import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { UserListItem, UsersPage } from '@/features/users/types';
import { rawPagedRequest, type ApiError } from '@/lib/http/client';

export const USERS_ENDPOINT = '/api/v1/users';

/**
 * The fields `GET /users` allow-lists for `sortBy`. Anything else is dropped by
 * the API, so a column that sorts must name one of these.
 */
export const USER_SORT_FIELDS = ['fullName', 'email', 'createdAt'] as const;

export type UserSort = { field: string; direction: 'asc' | 'desc' } | null;

export const usersKeys = {
  all: ['users'] as const,
  list: (page: number, limit: number, search: string, sort: UserSort) =>
    ['users', 'list', page, limit, search, sort?.field ?? '', sort?.direction ?? ''] as const,
};

/** `search` matches the name or the email server-side; '' means no filter. */
export function useUsers(
  page: number,
  limit: number,
  search = '',
  sort: UserSort = null,
): UseQueryResult<UsersPage, ApiError> {
  return useQuery<UsersPage, ApiError>({
    queryKey: usersKeys.list(page, limit, search, sort),
    queryFn: async () => {
      const response = await rawPagedRequest<UserListItem>(USERS_ENDPOINT, {
        params: {
          page,
          limit,
          ...(search === '' ? {} : { search }),
          ...(sort === null ? {} : { sortBy: sort.field, sortOrder: sort.direction }),
        },
      });
      return { items: response.data, meta: response.meta };
    },
    // Keeps the previous page on screen while a new search term loads, instead
    // of flashing the empty state between keystrokes.
    placeholderData: (previous) => previous,
  });
}
