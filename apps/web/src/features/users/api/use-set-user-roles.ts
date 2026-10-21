import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { usersKeys } from '@/features/users/api/use-users';
import { USER_ENDPOINTS } from '@/features/users/endpoints';
import type { SetUserRolesBody, UserListItem } from '@/features/users/types';
import { rawRequest, type ApiError } from '@/lib/http/client';
import { apiPath } from '@/lib/http/path';

export interface SetUserRolesVariables {
  id: string;
  body: SetUserRolesBody;
}

export function useSetUserRoles(): UseMutationResult<
  UserListItem,
  ApiError,
  SetUserRolesVariables
> {
  const queryClient = useQueryClient();

  return useMutation<UserListItem, ApiError, SetUserRolesVariables>({
    mutationFn: ({ id, body }) =>
      rawRequest<UserListItem>(apiPath(USER_ENDPOINTS.USER_ROLES, { id }), {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}
