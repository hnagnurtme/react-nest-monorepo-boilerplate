export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta | Record<string, unknown>;
}

export interface InvalidParam {
  name: string;
  reason: string;
}

/** RFC 9457 Problem Details — the shape of every error the API returns. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
  /** Quote this to support and they can find the request in the logs. */
  traceId?: string;
  invalidParams?: InvalidParam[];
}

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';
