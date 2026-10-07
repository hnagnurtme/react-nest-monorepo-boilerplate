import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { ROLES_ENDPOINT, rolesKeys } from '@/features/roles/api/use-roles';
import type { CreateRoleBody, RoleItem } from '@/features/roles/types';
import { rawRequest, type ApiError } from '@/lib/http/client';

export function useCreateRole(): UseMutationResult<RoleItem, ApiError, CreateRoleBody> {
  const queryClient = useQueryClient();

  return useMutation<RoleItem, ApiError, CreateRoleBody>({
    mutationFn: (body) =>
      rawRequest<RoleItem>(ROLES_ENDPOINT, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
    },
  });
}
