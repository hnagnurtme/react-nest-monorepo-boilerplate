import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { UserListItem, UsersPage } from '@/features/users/types';
import { rawPagedRequest, type ApiError } from '@/lib/http/client';

export const USERS_ENDPOINT = '/api/v1/users';

export const usersKeys = {
  all: ['users'] as const,
  list: (page: number, limit: number) => ['users', 'list', page, limit] as const,
};

export function useUsers(page: number, limit: number): UseQueryResult<UsersPage, ApiError> {
  return useQuery<UsersPage, ApiError>({
    queryKey: usersKeys.list(page, limit),
    queryFn: async () => {
      const response = await rawPagedRequest<UserListItem>(USERS_ENDPOINT, {
        params: { page, limit },
      });
      return { items: response.data, meta: response.meta };
    },
  });
}
