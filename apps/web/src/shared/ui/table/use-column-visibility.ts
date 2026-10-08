import { useLocalStorage } from '@/shared/hooks/use-local-storage';

import { type DataTableColumn } from './column-def';

const STORAGE_PREFIX = 'table-hidden-columns:';

export interface ColumnVisibility<T> {
  /** Pass to `DataTable` in place of the full `columns`. */
  visibleColumns: readonly DataTableColumn<T>[];
  /** The columns the menu may toggle — `hideable !== false`. */
  hideableColumns: readonly DataTableColumn<T>[];
  hiddenIds: readonly string[];
  toggle: (columnId: string) => void;
  reset: () => void;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/**
 * Which columns a user hid, remembered per table. It belongs in localStorage and
 * not in the URL: it is a preference about how this person reads the table, not
 * part of the view a link should reproduce for someone else.
 *
 * Ids that no longer match a column are dropped on read, so renaming or removing
 * a column cannot leave a table permanently missing one.
 */
export function useColumnVisibility<T>(
  tableId: string,
  columns: readonly DataTableColumn<T>[],
): ColumnVisibility<T> {
  const [stored, setStored] = useLocalStorage<string[]>(STORAGE_PREFIX + tableId, []);
  const storedIds = isStringArray(stored) ? stored : [];

  const hideableColumns = columns.filter((column) => column.hideable !== false);
  const hideableIds = new Set(hideableColumns.map((column) => column.id));
  const hiddenIds = storedIds.filter((id) => hideableIds.has(id));
  const hiddenSet = new Set(hiddenIds);

  return {
    visibleColumns: columns.filter((column) => !hiddenSet.has(column.id)),
    hideableColumns,
    hiddenIds,
    toggle: (columnId) => {
      setStored(
        hiddenSet.has(columnId)
          ? hiddenIds.filter((id) => id !== columnId)
          : [...hiddenIds, columnId],
      );
    },
    reset: () => {
      setStored([]);
    },
  };
}
