import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { loadProvinceShapes, type ProvinceShapes } from '@/lib/geo/province-shapes';

export const provinceShapesKey = ['province-shapes'] as const;

/** Reference geometry: fetched once per tab and never refetched. */
export function useProvinceShapes(): UseQueryResult<ProvinceShapes> {
  return useQuery<ProvinceShapes>({
    queryKey: provinceShapesKey,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: loadProvinceShapes,
  });
}
