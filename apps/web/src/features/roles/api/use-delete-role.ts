import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { rolesKeys } from '@/features/roles/api/use-roles';
import { ROLE_ENDPOINTS } from '@/features/roles/endpoints';
import { rawRequest, type ApiError } from '@/lib/http/client';
import { apiPath } from '@/lib/http/path';

export function useDeleteRole(): UseMutationResult<undefined, ApiError, string> {
  const queryClient = useQueryClient();

  return useMutation<undefined, ApiError, string>({
    mutationFn: async (id): Promise<undefined> => {
      await rawRequest<undefined>(apiPath(ROLE_ENDPOINTS.ROLE, { id }), {
        method: 'DELETE',
      });
      return undefined;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
    },
  });
}
