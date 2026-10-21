import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { usersKeys } from '@/features/users/api/use-users';
import { USER_ENDPOINTS } from '@/features/users/endpoints';
import type { CreateUserBody, UserListItem } from '@/features/users/types';
import { rawRequest, type ApiError } from '@/lib/http/client';

export function useCreateUser(): UseMutationResult<UserListItem, ApiError, CreateUserBody> {
  const queryClient = useQueryClient();

  return useMutation<UserListItem, ApiError, CreateUserBody>({
    mutationFn: (body) =>
      rawRequest<UserListItem>(USER_ENDPOINTS.USERS, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}
