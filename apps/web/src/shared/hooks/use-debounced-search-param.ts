import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useDebounce } from './use-debounce';

const DEFAULT_DELAY_MS = 300;

export interface DebouncedSearchParam {
  /** Bind this to the input: it updates on every keystroke. */
  inputValue: string;
  setInputValue: (value: string) => void;
  /**
   * The term currently in the URL. It changes only once the debounce has
   * committed, in the same render as the page reset, so a consumer never fires
   * a request for "new term, old page".
   */
  value: string;
  clear: () => void;
}

/**
 * A search box backed by the URL. The input stays responsive while the request
 * waits for typing to stop, the term survives a reload or a shared link, and
 * changing it returns to page 1 — page 7 of the old result set is meaningless.
 */
export function useDebouncedSearchParam(
  paramName = 'q',
  delayMs = DEFAULT_DELAY_MS,
): DebouncedSearchParam {
  const [searchParams, setSearchParams] = useSearchParams();
  const committed = searchParams.get(paramName) ?? '';

  const [inputValue, setInputValue] = useState(committed);
  const debounced = useDebounce(inputValue.trim(), delayMs);

  useEffect(() => {
    if (debounced === committed) return;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (debounced === '') next.delete(paramName);
        else next.set(paramName, debounced);
        next.delete('page');
        return next;
      },
      // A keystroke must not add a history entry per character.
      { replace: true },
    );
  }, [committed, debounced, paramName, setSearchParams]);

  const clear = useCallback(() => {
    setInputValue('');
  }, []);

  return useMemo(
    () => ({ inputValue, setInputValue, value: committed, clear }),
    [inputValue, committed, clear],
  );
}
