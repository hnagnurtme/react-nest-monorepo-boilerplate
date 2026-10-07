import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { USERS_ENDPOINT, usersKeys } from '@/features/users/api/use-users';
import type { UpdateUserBody, UserListItem } from '@/features/users/types';
import { rawRequest, type ApiError } from '@/lib/http/client';

export interface UpdateUserVariables {
  id: string;
  body: UpdateUserBody;
}

export function useUpdateUser(): UseMutationResult<UserListItem, ApiError, UpdateUserVariables> {
  const queryClient = useQueryClient();

  return useMutation<UserListItem, ApiError, UpdateUserVariables>({
    mutationFn: ({ id, body }) =>
      rawRequest<UserListItem>(`${USERS_ENDPOINT}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}
