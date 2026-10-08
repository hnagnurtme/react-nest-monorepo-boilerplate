import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type UrlValue = string | number | boolean;

export interface UrlField<T extends UrlValue> {
  /** Never written to the URL: a param equal to its default is removed. */
  default: T;
  parse: (raw: string) => T;
  serialize?: (value: T) => string;
}

export type UrlStateSchema<T extends Record<string, UrlValue>> = {
  [K in keyof T]: UrlField<T[K]>;
};

export interface UseUrlStateOptions<T> {
  /**
   * Keys that send the list back to page one when they change — every filter and
   * the search box, never `page` itself. Without this, narrowing a list while on
   * page 4 shows an empty table and reads as "the filter is broken".
   */
  resetPageOn?: readonly (keyof T)[];
  /** The page param's name, if the list does not call it `page`. */
  pageKey?: string;
}

/** Common field shapes, so a page does not hand-roll `parse` for a flag. */
export const urlString = (fallback = ''): UrlField<string> => ({
  default: fallback,
  parse: (raw) => raw,
});

export const urlNumber = (fallback: number): UrlField<number> => ({
  default: fallback,
  parse: (raw) => {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
});

export const urlBoolean = (fallback = false): UrlField<boolean> => ({
  default: fallback,
  parse: (raw) => raw === 'true',
});

/**
 * Typed `useSearchParams` for a list view's state: the URL stays the single
 * source of truth, so a reload, a back button and a pasted link all reproduce
 * the same table. Defaults never appear in the query string, which keeps a
 * freshly opened list at a clean `/users`.
 */
export function useUrlState<T extends Record<string, UrlValue>>(
  schema: UrlStateSchema<T>,
  options?: UseUrlStateOptions<T>,
): [T, (patch: Partial<T>) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageKey = options?.pageKey ?? 'page';

  const state = useMemo(() => {
    const entries = Object.keys(schema).map((key) => {
      const field = schema[key as keyof T];
      const raw = searchParams.get(key);
      return [key, raw === null ? field.default : field.parse(raw)];
    });
    return Object.fromEntries(entries) as T;
  }, [schema, searchParams]);

  const setState = useCallback(
    (patch: Partial<T>) => {
      // The functional form, not a captured snapshot: a page may also run
      // `usePageParam` or `useDebouncedSearchParam`, and two hooks writing from
      // their own snapshot of the query string drop each other's params.
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          let resetsPage = false;

          for (const key of Object.keys(patch)) {
            const field = schema[key as keyof T];
            const value = patch[key as keyof T];

            if (value === undefined || value === field.default) {
              next.delete(key);
            } else {
              const serialize = field.serialize ?? String;
              next.set(key, serialize(value));
            }

            if (options?.resetPageOn?.includes(key) === true) resetsPage = true;
          }

          if (resetsPage) next.delete(pageKey);

          return next;
        },
        // Filtering is not navigation: twelve keystrokes must not cost twelve
        // presses of the back button.
        { replace: true },
      );
    },
    [options?.resetPageOn, pageKey, schema, setSearchParams],
  );

  return [state, setState];
}
