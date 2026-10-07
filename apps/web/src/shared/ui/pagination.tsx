import { Button } from './button';

const FIRST_PAGE = 1;

export interface PaginationProps {
  page: number;
  totalPages: number;
  /** Pre-translated summary, e.g. "Page 1 of 2 (40 users)". */
  summary: string;
  previousLabel: string;
  nextLabel: string;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  totalPages,
  summary,
  previousLabel,
  nextLabel,
  onPageChange,
}: PaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-muted-foreground text-sm">{summary}</span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={page <= FIRST_PAGE}
          onClick={() => {
            onPageChange(page - 1);
          }}
        >
          {previousLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => {
            onPageChange(page + 1);
          }}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
