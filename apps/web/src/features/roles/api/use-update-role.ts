import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { ROLES_ENDPOINT, rolesKeys } from '@/features/roles/api/use-roles';
import type { RoleItem, UpdateRoleBody } from '@/features/roles/types';
import { rawRequest, type ApiError } from '@/lib/http/client';

export interface UpdateRoleVariables {
  id: string;
  body: UpdateRoleBody;
}

/** Rename a role. The role's permissions are changed with useSetRolePermissions. */
export function useUpdateRole(): UseMutationResult<RoleItem, ApiError, UpdateRoleVariables> {
  const queryClient = useQueryClient();

  return useMutation<RoleItem, ApiError, UpdateRoleVariables>({
    mutationFn: ({ id, body }) =>
      rawRequest<RoleItem>(`${ROLES_ENDPOINT}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      // Role names are also shown on user rows.
      await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
