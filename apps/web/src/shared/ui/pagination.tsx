import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

import { CONTROL_SIZE } from './control';
import { FOCUS_RING } from './focus-ring';
import { IconButton } from './icon-button';
import { Select } from './select';

const FIRST_PAGE = 1;
/** One page either side of the current one, plus the two ends. */
const WINDOW = 1;
const PAGE_SIZES = [10, 20, 50, 100];

export interface PaginationProps {
  page: number;
  totalPages: number;
  /** Pre-translated summary, e.g. "1–20 of 137 users". */
  summary: string;
  previousLabel: string;
  nextLabel: string;
  onPageChange: (page: number) => void;
  /** Pre-translated, e.g. "Page {{page}}". */
  pageLabel?: string;
  /** Omit for a fixed page size: the rows-per-page select is then hidden. */
  pageSize?: number;
  onPageSizeChange?: ((size: number) => void) | undefined;
  pageSizeLabel?: string;
}

/**
 * Builds the page list with ellipses. Numbered pages, not only prev/next: on a
 * 40-page list "next" is the only way to reach page 30, and a user who knows
 * the row was near the end has no way to say so.
 */
function pageNumbers(current: number, totalPages: number): (number | 'gap')[] {
  const pages: (number | 'gap')[] = [];

  for (let page = FIRST_PAGE; page <= totalPages; page += 1) {
    const isEnd = page === FIRST_PAGE || page === totalPages;
    if (isEnd || Math.abs(page - current) <= WINDOW) {
      pages.push(page);
    } else if (pages.at(-1) !== 'gap') {
      pages.push('gap');
    }
  }

  return pages;
}

export function Pagination({
  page,
  totalPages,
  summary,
  previousLabel,
  nextLabel,
  onPageChange,
  pageLabel = 'Page {{page}}',
  pageSize,
  onPageSizeChange,
  pageSizeLabel = 'Rows per page',
}: PaginationProps) {
  const lastPage = Math.max(totalPages, FIRST_PAGE);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span aria-live="polite" className="text-muted-foreground text-body tabular-nums">
        {summary}
      </span>
      <div className="flex items-center gap-3">
        {pageSize === undefined || onPageSizeChange === undefined ? null : (
          <label className="text-muted-foreground text-body flex items-center gap-2 whitespace-nowrap">
            {pageSizeLabel}
            <Select
              size="sm"
              aria-label={pageSizeLabel}
              value={String(pageSize)}
              options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
              onChange={(event) => {
                onPageSizeChange(Number(event.target.value));
              }}
              className="w-20"
            />
          </label>
        )}
        <div className="flex items-center gap-1">
          <IconButton
            size="sm"
            variant="outline"
            label={previousLabel}
            disabled={page <= FIRST_PAGE}
            onClick={() => {
              onPageChange(page - 1);
            }}
            icon={<ChevronLeft aria-hidden="true" className="size-4" />}
          />
          {pageNumbers(page, lastPage).map((entry, index) =>
            entry === 'gap' ? (
              <span
                key={`gap-${String(index)}`}
                aria-hidden="true"
                className="text-muted-foreground px-1"
              >
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                aria-label={pageLabel.replace('{{page}}', String(entry))}
                aria-current={entry === page ? 'page' : undefined}
                onClick={() => {
                  onPageChange(entry);
                }}
                className={cn(
                  'text-body rounded-control flex cursor-pointer items-center justify-center tabular-nums transition-colors',
                  CONTROL_SIZE.sm,
                  entry === page
                    ? 'bg-selected text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  FOCUS_RING,
                )}
              >
                {entry}
              </button>
            ),
          )}
          <IconButton
            size="sm"
            variant="outline"
            label={nextLabel}
            disabled={page >= lastPage}
            onClick={() => {
              onPageChange(page + 1);
            }}
            icon={<ChevronRight aria-hidden="true" className="size-4" />}
          />
        </div>
      </div>
    </div>
  );
}
