import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { USERS_ENDPOINT, usersKeys } from '@/features/users/api/use-users';
import type { SetUserRolesBody, UserListItem } from '@/features/users/types';
import { rawRequest, type ApiError } from '@/lib/http/client';

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
      rawRequest<UserListItem>(`${USERS_ENDPOINT}/${encodeURIComponent(id)}/roles`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}
