import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { ROLES_ENDPOINT, rolesKeys } from '@/features/roles/api/use-roles';
import { rawRequest, type ApiError } from '@/lib/http/client';

export function useDeleteRole(): UseMutationResult<undefined, ApiError, string> {
  const queryClient = useQueryClient();

  return useMutation<undefined, ApiError, string>({
    mutationFn: async (id): Promise<undefined> => {
      await rawRequest<undefined>(`${ROLES_ENDPOINT}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return undefined;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
    },
  });
}
