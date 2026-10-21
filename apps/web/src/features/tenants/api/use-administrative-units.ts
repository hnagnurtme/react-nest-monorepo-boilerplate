import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { TENANT_ENDPOINTS } from '@/features/tenants/endpoints';
import type { AdministrativeUnit } from '@/features/tenants/types';
import { rawRequest, type ApiError } from '@/lib/http/client';
import { apiPath } from '@/lib/http/path';

export const administrativeUnitKeys = {
  provinces: ['administrative-units', 'provinces'] as const,
  wards: (provinceCode: string) => ['administrative-units', 'wards', provinceCode] as const,
};

/**
 * Vietnam's 34 provinces after the 1 July 2025 merger. Reference data that only
 * changes by migration, so it is cached for the life of the tab.
 */
export function useProvinces(): UseQueryResult<AdministrativeUnit[], ApiError> {
  return useQuery<AdministrativeUnit[], ApiError>({
    queryKey: administrativeUnitKeys.provinces,
    staleTime: Infinity,
    queryFn: () => rawRequest<AdministrativeUnit[]>(TENANT_ENDPOINTS.PROVINCES),
  });
}

/**
 * The wards of one province — the second dropdown, loaded once the first is
 * answered. There is no district level between them any more.
 */
export function useWards(
  provinceCode: string | null,
): UseQueryResult<AdministrativeUnit[], ApiError> {
  return useQuery<AdministrativeUnit[], ApiError>({
    queryKey: administrativeUnitKeys.wards(provinceCode ?? ''),
    enabled: provinceCode !== null,
    staleTime: Infinity,
    queryFn: () =>
      rawRequest<AdministrativeUnit[]>(
        apiPath(TENANT_ENDPOINTS.WARDS, { code: provinceCode ?? '' }),
      ),
  });
}
