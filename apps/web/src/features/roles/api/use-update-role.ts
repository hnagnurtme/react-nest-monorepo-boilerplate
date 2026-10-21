import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { rolesKeys } from '@/features/roles/api/use-roles';
import { ROLE_ENDPOINTS } from '@/features/roles/endpoints';
import type { RoleItem, UpdateRoleBody } from '@/features/roles/types';
import { rawRequest, type ApiError } from '@/lib/http/client';
import { apiPath } from '@/lib/http/path';

export interface UpdateRoleVariables {
  id: string;
  body: UpdateRoleBody;
}

/** Rename a role. The role's permissions are changed with useSetRolePermissions. */
export function useUpdateRole(): UseMutationResult<RoleItem, ApiError, UpdateRoleVariables> {
  const queryClient = useQueryClient();

  return useMutation<RoleItem, ApiError, UpdateRoleVariables>({
    mutationFn: ({ id, body }) =>
      rawRequest<RoleItem>(apiPath(ROLE_ENDPOINTS.ROLE, { id }), {
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
