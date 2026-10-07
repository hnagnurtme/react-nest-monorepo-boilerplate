import { useCallback, useState } from 'react';

/**
 * Per-viewer convenience state (a remembered tab, a collapsed panel). Every
 * access is guarded: storage throws in private mode and with blocked site data,
 * and what it holds never reaches another device, so nothing important lives here.
 */
export function useLocalStorage<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  const store = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Keep the in-memory value; persistence is best-effort by design.
      }
    },
    [key],
  );

  return [value, store];
}
