import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/http/client';
import { apiErrorKind } from '@/lib/http/error-message';
import {
  useApiErrorMessage,
  useDebounce,
  useDebouncedSearchParam,
  useDisclosure,
  useLocalStorage,
  usePageParam,
} from '@/shared/hooks';

function routerWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

describe('useDebounce', () => {
  it('reports the latest value only after the delay has passed', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('ab');
    vi.useRealTimers();
  });
});

describe('useDisclosure', () => {
  it('opens, closes and toggles', () => {
    const { result } = renderHook(() => useDisclosure());

    expect(result.current.isOpen).toBe(false);
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(false);
  });
});

describe('usePageParam', () => {
  it('falls back to page 1 for a missing or malformed value', () => {
    const { result } = renderHook(() => usePageParam(), {
      wrapper: routerWrapper(['/users?page=zero']),
    });

    expect(result.current.page).toBe(1);
  });

  it('writes the page into the URL and keeps the other params', async () => {
    const { result } = renderHook(
      () => ({ pageParam: usePageParam(), search: useSearchParams()[0].toString() }),
      { wrapper: routerWrapper(['/users?page=2&q=ada']) },
    );

    expect(result.current.pageParam.page).toBe(2);

    act(() => {
      result.current.pageParam.goToPage(3);
    });

    await waitFor(() => {
      expect(result.current.search).toBe('page=3&q=ada');
    });
  });

  it('never goes below the first page', async () => {
    const { result } = renderHook(
      () => ({ pageParam: usePageParam(), search: useSearchParams()[0].toString() }),
      { wrapper: routerWrapper(['/users?page=1']) },
    );

    act(() => {
      result.current.pageParam.goToPage(0);
    });

    await waitFor(() => {
      expect(result.current.search).toBe('page=1');
    });
  });
});

describe('useDebouncedSearchParam', () => {
  it('reads the term already in the URL', () => {
    const { result } = renderHook(() => useDebouncedSearchParam(), {
      wrapper: routerWrapper(['/users?q=ada']),
    });

    expect(result.current.inputValue).toBe('ada');
    expect(result.current.value).toBe('ada');
  });

  it('commits the trimmed term to the URL and drops the page', async () => {
    const { result } = renderHook(
      () => ({
        search: useDebouncedSearchParam('q', 10),
        params: useSearchParams()[0].toString(),
      }),
      { wrapper: routerWrapper(['/users?page=3']) },
    );

    act(() => {
      result.current.search.setInputValue('  ada  ');
    });

    // The input is live while the committed value waits for the debounce.
    expect(result.current.search.inputValue).toBe('  ada  ');
    expect(result.current.search.value).toBe('');

    await waitFor(() => {
      expect(result.current.params).toBe('q=ada');
    });
    expect(result.current.search.value).toBe('ada');
  });

  it('removes the param when cleared', async () => {
    const { result } = renderHook(
      () => ({
        search: useDebouncedSearchParam('q', 10),
        params: useSearchParams()[0].toString(),
      }),
      { wrapper: routerWrapper(['/users?q=ada']) },
    );

    act(() => {
      result.current.search.clear();
    });

    await waitFor(() => {
      expect(result.current.params).toBe('');
    });
    expect(result.current.search.value).toBe('');
  });
});

describe('useLocalStorage', () => {
  it('round-trips a value and survives unreadable storage', () => {
    const { result } = renderHook(() => useLocalStorage('test.key', 'initial'));

    act(() => {
      result.current[1]('stored');
    });

    expect(result.current[0]).toBe('stored');
    expect(localStorage.getItem('test.key')).toBe('"stored"');
    localStorage.clear();
  });
});

describe('apiErrorKind and useApiErrorMessage', () => {
  const error = (status: number) => new ApiError('failed', { status, code: 'SOMETHING' });

  it('classifies the statuses the UI words differently', () => {
    expect(apiErrorKind(error(403))).toBe('forbidden');
    expect(apiErrorKind(error(404))).toBe('notFound');
    expect(apiErrorKind(error(409))).toBe('conflict');
    expect(apiErrorKind(error(422))).toBe('invalid');
    expect(apiErrorKind(error(500))).toBe('unexpected');
  });

  it('translates a known kind and prefers the caller fallback otherwise', () => {
    const { result } = renderHook(() => useApiErrorMessage());

    expect(result.current(error(403))).toBe('You do not have permission to do that.');
    expect(result.current(error(500), 'Could not delete the user.')).toBe(
      'Could not delete the user.',
    );
    expect(result.current(error(500))).toBe('Something went wrong. Please try again.');
  });
});
