import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { abilityKeys } from '@/features/auth';
import { rolesKeys } from '@/features/roles/api/use-roles';
import { ROLE_ENDPOINTS } from '@/features/roles/endpoints';
import type { RoleItem, SetRolePermissionsBody } from '@/features/roles/types';
import { rawRequest, type ApiError } from '@/lib/http/client';
import { apiPath } from '@/lib/http/path';

export interface SetRolePermissionsVariables {
  id: string;
  body: SetRolePermissionsBody;
}

export function useSetRolePermissions(): UseMutationResult<
  RoleItem,
  ApiError,
  SetRolePermissionsVariables
> {
  const queryClient = useQueryClient();

  return useMutation<RoleItem, ApiError, SetRolePermissionsVariables>({
    mutationFn: ({ id, body }) =>
      rawRequest<RoleItem>(apiPath(ROLE_ENDPOINTS.ROLE_PERMISSIONS, { id }), {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
      // The caller may hold the edited role, so their own ability may have changed.
      await queryClient.invalidateQueries({ queryKey: abilityKeys.all });
    },
  });
}
