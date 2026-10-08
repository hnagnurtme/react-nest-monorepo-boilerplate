import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { urlBoolean, urlNumber, urlString, useUrlState, type UrlStateSchema } from '@/shared/hooks';
import {
  DataTable,
  FilterChips,
  Pagination,
  nextSort,
  parseSort,
  serializeSort,
  useColumnVisibility,
  type DataTableColumn,
} from '@/shared/ui';

interface Row {
  id: string;
  name: string;
  seats: number;
}

const ROWS: Row[] = [
  { id: '1', name: 'Ada', seats: 3 },
  { id: '2', name: 'Grace', seats: 12 },
];

const COLUMNS: readonly DataTableColumn<Row>[] = [
  { id: 'name', header: 'Name', sortable: true, hideable: false, cell: (row) => row.name },
  { id: 'seats', header: 'Seats', kind: 'number', sortable: true, cell: (row) => row.seats },
  { id: 'notes', header: 'Notes', cell: () => 'n/a' },
];

function routerWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

describe('sort state', () => {
  it('cycles ascending, descending, then off', () => {
    const first = nextSort(null, 'name');
    expect(first).toEqual({ field: 'name', direction: 'asc' });

    const second = nextSort(first, 'name');
    expect(second).toEqual({ field: 'name', direction: 'desc' });

    // The third click must reach "no sort": otherwise a list can never return to
    // the order the API chose, which is the only one that puts new rows first.
    expect(nextSort(second, 'name')).toBeNull();
  });

  it('starts a different column ascending rather than inheriting the direction', () => {
    expect(nextSort({ field: 'name', direction: 'desc' }, 'seats')).toEqual({
      field: 'seats',
      direction: 'asc',
    });
  });

  it('round-trips through the URL param', () => {
    const sort = { field: 'createdAt', direction: 'desc' } as const;
    expect(parseSort(serializeSort(sort))).toEqual(sort);
    expect(parseSort('')).toBeNull();
    expect(serializeSort(null)).toBe('');
  });
});

describe('DataTable sorting', () => {
  it('announces the sorted column and direction', async () => {
    const onSortChange = vi.fn();
    render(
      <MemoryRouter>
        <DataTable
          caption="People"
          columns={COLUMNS}
          rows={ROWS}
          rowKey={(row) => row.id}
          sort={{ field: 'name', direction: 'asc' }}
          onSortChange={onSortChange}
          sortLabel="Sort by {{column}}"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    // A sortable column that reports no state reads as plain text to a reader.
    expect(screen.getByRole('columnheader', { name: /Seats/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
    expect(screen.getByRole('columnheader', { name: 'Notes' })).not.toHaveAttribute('aria-sort');

    await userEvent.click(screen.getByRole('button', { name: 'Sort by Name' }));
    expect(onSortChange).toHaveBeenCalledWith({ field: 'name', direction: 'desc' });
  });

  it('leaves every column unsortable when no handler is given', () => {
    render(
      <MemoryRouter>
        <DataTable caption="People" columns={COLUMNS} rows={ROWS} rowKey={(row) => row.id} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /Sort by/ })).not.toBeInTheDocument();
  });
});

describe('DataTable states', () => {
  const renderState = (
    state: 'loading' | 'reloading' | 'empty' | 'no-results' | 'error',
  ): ReturnType<typeof render> =>
    render(
      <MemoryRouter>
        <DataTable
          caption="People"
          columns={COLUMNS}
          rows={state === 'reloading' ? ROWS : []}
          rowKey={(row) => row.id}
          state={state}
          pageSize={3}
          toolbar={<div data-testid="toolbar" />}
          emptyState={<p>Nothing here yet</p>}
          noResultsState={<p>No match</p>}
          errorState={<p role="alert">Could not load</p>}
        />
      </MemoryRouter>,
    );

  it.each(['loading', 'reloading', 'empty', 'no-results', 'error'] as const)(
    'keeps the toolbar and the header in the %s state',
    (state) => {
      renderState(state);

      // A filter that matched nothing must not remove the control that undoes it.
      expect(screen.getByTestId('toolbar')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
    },
  );

  it('tells an empty list apart from a filtered one', () => {
    renderState('empty');
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();

    renderState('no-results');
    expect(screen.getByText('No match')).toBeInTheDocument();
  });

  it('marks a first load busy and draws one placeholder per expected row', () => {
    renderState('loading');

    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    // 3 skeleton rows plus the header row.
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });

  it('keeps the rows on screen while refetching', () => {
    renderState('reloading');

    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
  });
});

describe('Pagination', () => {
  const renderPagination = (page: number, totalPages: number, onPageChange = vi.fn()) => {
    render(
      <Pagination
        page={page}
        totalPages={totalPages}
        summary={`Page ${String(page)}`}
        previousLabel="Previous"
        nextLabel="Next"
        pageLabel="Page {{page}}"
        onPageChange={onPageChange}
      />,
    );
    return onPageChange;
  };

  it('offers the ends and the window around the current page', () => {
    renderPagination(5, 20);

    for (const label of ['Page 1', 'Page 4', 'Page 5', 'Page 6', 'Page 20']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    // Not every page in between, or 20 pages becomes 20 buttons.
    expect(screen.queryByRole('button', { name: 'Page 10' })).not.toBeInTheDocument();
  });

  it('marks the current page and disables the edge it cannot move past', () => {
    renderPagination(1, 3);

    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('jumps straight to a numbered page', async () => {
    const onPageChange = renderPagination(1, 9);

    await userEvent.click(screen.getByRole('button', { name: 'Page 9' }));
    expect(onPageChange).toHaveBeenCalledWith(9);
  });

  it('hides the page-size select when the size is fixed', () => {
    renderPagination(1, 2);
    expect(screen.queryByLabelText('Rows per page')).not.toBeInTheDocument();
  });
});

describe('useColumnVisibility', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('hides a toggled column and remembers it under the table id', () => {
    const { result } = renderHook(() => useColumnVisibility('people', COLUMNS));

    act(() => {
      result.current.toggle('notes');
    });

    expect(result.current.visibleColumns.map((column) => column.id)).toEqual(['name', 'seats']);
    expect(window.localStorage.getItem('table-hidden-columns:people')).toBe('["notes"]');
  });

  it('never offers a column marked unhideable', () => {
    const { result } = renderHook(() => useColumnVisibility('people', COLUMNS));

    expect(result.current.hideableColumns.map((column) => column.id)).toEqual(['seats', 'notes']);
  });

  it('drops a stored id that no longer matches a column', () => {
    window.localStorage.setItem('table-hidden-columns:people', '["gone","notes"]');
    const { result } = renderHook(() => useColumnVisibility('people', COLUMNS));

    // Otherwise renaming a column leaves a table permanently missing one.
    expect(result.current.hiddenIds).toEqual(['notes']);
  });

  it('brings every column back on reset', () => {
    const { result } = renderHook(() => useColumnVisibility('people', COLUMNS));

    act(() => {
      result.current.toggle('seats');
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.visibleColumns).toHaveLength(COLUMNS.length);
  });
});

describe('FilterChips', () => {
  it('renders nothing while no filter is active', () => {
    const { container } = render(
      <FilterChips chips={[]} clearAllLabel="Clear all" onClearAll={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('removes one filter or all of them', async () => {
    const onRemove = vi.fn();
    const onClearAll = vi.fn();
    render(
      <FilterChips
        chips={[{ key: 'role', label: 'Role: Admin', removeLabel: 'Remove role filter', onRemove }]}
        clearAllLabel="Clear all"
        onClearAll={onClearAll}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remove role filter' }));
    expect(onRemove).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onClearAll).toHaveBeenCalledOnce();
  });
});

const VIEW_SCHEMA: UrlStateSchema<{ sort: string; limit: number; archived: boolean }> = {
  sort: urlString(''),
  limit: urlNumber(20),
  archived: urlBoolean(false),
};

function useViewHarness() {
  const [view, setView] = useUrlState(VIEW_SCHEMA, { resetPageOn: ['archived'] });
  return { view, setView, search: useLocation().search };
}

describe('useUrlState', () => {
  it('falls back to the declared defaults when the URL says nothing', () => {
    const { result } = renderHook(useViewHarness, { wrapper: routerWrapper(['/users']) });

    expect(result.current.view).toEqual({ sort: '', limit: 20, archived: false });
  });

  it('parses each field by its declared type', () => {
    const { result } = renderHook(useViewHarness, {
      wrapper: routerWrapper(['/users?sort=email:desc&limit=50&archived=true']),
    });

    expect(result.current.view).toEqual({ sort: 'email:desc', limit: 50, archived: true });
  });

  it('keeps a default out of the query string', () => {
    const { result } = renderHook(useViewHarness, { wrapper: routerWrapper(['/users?limit=50']) });

    act(() => {
      result.current.setView({ limit: 20 });
    });

    // A freshly opened list stays at a clean /users.
    expect(result.current.search).toBe('');
  });

  it('returns to page one when a filter changes', () => {
    const { result } = renderHook(useViewHarness, { wrapper: routerWrapper(['/users?page=4']) });

    act(() => {
      result.current.setView({ archived: true });
    });

    // Narrowing a list while on page 4 would otherwise show an empty table.
    expect(result.current.search).toBe('?archived=true');
  });

  it('leaves the page alone for a field that is not a filter', () => {
    const { result } = renderHook(useViewHarness, { wrapper: routerWrapper(['/users?page=4']) });

    act(() => {
      result.current.setView({ sort: 'email:asc' });
    });

    expect(result.current.search).toBe('?page=4&sort=email%3Aasc');
  });
});
