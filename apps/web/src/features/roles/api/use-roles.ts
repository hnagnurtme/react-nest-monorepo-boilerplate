import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { PermissionOption, RoleItem, RolesPageData } from '@/features/roles/types';
import { rawPagedRequest, rawRequest, type ApiError } from '@/lib/http/client';

export const ROLES_ENDPOINT = '/api/v1/roles';
export const PERMISSIONS_ENDPOINT = '/api/v1/permissions';

export const rolesKeys = {
  all: ['roles'] as const,
  list: (page: number, limit: number) => ['roles', 'list', page, limit] as const,
  detail: (id: string) => ['roles', 'detail', id] as const,
  permissions: ['roles', 'permissions'] as const,
};

export function useRoles(
  page: number,
  limit: number,
  options: { enabled?: boolean } = {},
): UseQueryResult<RolesPageData, ApiError> {
  return useQuery<RolesPageData, ApiError>({
    queryKey: rolesKeys.list(page, limit),
    enabled: options.enabled ?? true,
    queryFn: async () => {
      const response = await rawPagedRequest<RoleItem>(ROLES_ENDPOINT, {
        params: { page, limit },
      });
      return { items: response.data, meta: response.meta };
    },
  });
}

export function useRole(id: string | null): UseQueryResult<RoleItem, ApiError> {
  return useQuery<RoleItem, ApiError>({
    queryKey: rolesKeys.detail(id ?? ''),
    enabled: id !== null,
    queryFn: () => rawRequest<RoleItem>(`${ROLES_ENDPOINT}/${encodeURIComponent(id ?? '')}`),
  });
}

/** What the caller may put into a role (catalog entries and the reach presets offered). */
export function usePermissionOptions(
  options: { enabled?: boolean } = {},
): UseQueryResult<PermissionOption[], ApiError> {
  return useQuery<PermissionOption[], ApiError>({
    queryKey: rolesKeys.permissions,
    enabled: options.enabled ?? true,
    queryFn: () => rawRequest<PermissionOption[]>(PERMISSIONS_ENDPOINT),
  });
}
