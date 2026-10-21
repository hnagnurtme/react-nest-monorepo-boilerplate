import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { usersKeys } from '@/features/users/api/use-users';
import { USER_ENDPOINTS } from '@/features/users/endpoints';
import type { UpdateUserBody, UserListItem } from '@/features/users/types';
import { rawRequest, type ApiError } from '@/lib/http/client';
import { apiPath } from '@/lib/http/path';

export interface UpdateUserVariables {
  id: string;
  body: UpdateUserBody;
}

export function useUpdateUser(): UseMutationResult<UserListItem, ApiError, UpdateUserVariables> {
  const queryClient = useQueryClient();

  return useMutation<UserListItem, ApiError, UpdateUserVariables>({
    mutationFn: ({ id, body }) =>
      rawRequest<UserListItem>(apiPath(USER_ENDPOINTS.USER, { id }), {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}
