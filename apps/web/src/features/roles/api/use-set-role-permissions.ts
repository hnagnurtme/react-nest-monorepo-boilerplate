import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { abilityKeys } from '@/features/auth';
import { ROLES_ENDPOINT, rolesKeys } from '@/features/roles/api/use-roles';
import type { RoleItem, SetRolePermissionsBody } from '@/features/roles/types';
import { rawRequest, type ApiError } from '@/lib/http/client';

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
      rawRequest<RoleItem>(`${ROLES_ENDPOINT}/${encodeURIComponent(id)}/permissions`, {
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
