import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { UserListItem, UsersPage } from '@/features/users/types';
import { rawPagedRequest, type ApiError } from '@/lib/http/client';

export const USERS_ENDPOINT = '/api/v1/users';

export const usersKeys = {
  all: ['users'] as const,
  list: (page: number, limit: number, search: string) =>
    ['users', 'list', page, limit, search] as const,
};

/** `search` matches the name or the email server-side; '' means no filter. */
export function useUsers(
  page: number,
  limit: number,
  search = '',
): UseQueryResult<UsersPage, ApiError> {
  return useQuery<UsersPage, ApiError>({
    queryKey: usersKeys.list(page, limit, search),
    queryFn: async () => {
      const response = await rawPagedRequest<UserListItem>(USERS_ENDPOINT, {
        params: { page, limit, ...(search === '' ? {} : { search }) },
      });
      return { items: response.data, meta: response.meta };
    },
    // Keeps the previous page on screen while a new search term loads, instead
    // of flashing the empty state between keystrokes.
    placeholderData: (previous) => previous,
  });
}
