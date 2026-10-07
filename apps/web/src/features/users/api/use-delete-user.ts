import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { USERS_ENDPOINT, usersKeys } from '@/features/users/api/use-users';
import { rawRequest, type ApiError } from '@/lib/http/client';

export function useDeleteUser(): UseMutationResult<undefined, ApiError, string> {
  const queryClient = useQueryClient();

  return useMutation<undefined, ApiError, string>({
    mutationFn: async (id): Promise<undefined> => {
      await rawRequest<undefined>(`${USERS_ENDPOINT}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return undefined;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}
