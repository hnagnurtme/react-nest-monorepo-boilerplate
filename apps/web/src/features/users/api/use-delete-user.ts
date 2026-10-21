import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { usersKeys } from '@/features/users/api/use-users';
import { USER_ENDPOINTS } from '@/features/users/endpoints';
import { rawRequest, type ApiError } from '@/lib/http/client';
import { apiPath } from '@/lib/http/path';

export function useDeleteUser(): UseMutationResult<undefined, ApiError, string> {
  const queryClient = useQueryClient();

  return useMutation<undefined, ApiError, string>({
    mutationFn: async (id): Promise<undefined> => {
      await rawRequest<undefined>(apiPath(USER_ENDPOINTS.USER, { id }), {
        method: 'DELETE',
      });
      return undefined;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}
