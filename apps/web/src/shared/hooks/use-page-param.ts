import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export const FIRST_PAGE = 1;

export interface PageParam {
  page: number;
  goToPage: (page: number) => void;
}

/**
 * Reads and writes the `page` search param. Pagination lives in the URL so a
 * list page is shareable and survives a reload; a malformed value falls back to 1.
 */
export function usePageParam(paramName = 'page'): PageParam {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(paramName);

  const page = useMemo(() => {
    const parsed = Number.parseInt(raw ?? '', 10);
    return Number.isInteger(parsed) && parsed >= FIRST_PAGE ? parsed : FIRST_PAGE;
  }, [raw]);

  const goToPage = useCallback(
    (next: number) => {
      setSearchParams((previous) => {
        const params = new URLSearchParams(previous);
        params.set(paramName, String(Math.max(next, FIRST_PAGE)));
        return params;
      });
    },
    [paramName, setSearchParams],
  );

  return useMemo(() => ({ page, goToPage }), [page, goToPage]);
}
