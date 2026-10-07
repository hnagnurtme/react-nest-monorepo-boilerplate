import type { paths } from '@repo/api-contract';

export const HTTP_METHOD = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  DELETE: 'delete',
  PATCH: 'patch',
} as const;

export type HttpMethod = (typeof HTTP_METHOD)[keyof typeof HTTP_METHOD];

export type PrimaryMethod<P extends keyof paths> = 'post' extends keyof paths[P]
  ? 'post'
  : 'get' extends keyof paths[P]
    ? 'get'
    : 'put' extends keyof paths[P]
      ? 'put'
      : 'delete' extends keyof paths[P]
        ? 'delete'
        : 'patch' extends keyof paths[P]
          ? 'patch'
          : never;

export type ApiRequestBody<
  P extends keyof paths,
  M extends HttpMethod = PrimaryMethod<P>,
> = paths[P][M] extends { requestBody: { content: { 'application/json': infer B } } } ? B : never;

type JsonResponseContent<P extends keyof paths, M extends HttpMethod> = paths[P][M] extends {
  responses: { 200: { content: { 'application/json': infer R } } };
}
  ? R
  : paths[P][M] extends { responses: { 201: { content: { 'application/json': infer R } } } }
    ? R
    : never;

type UnwrapApiEnvelope<T> = T extends { data: infer D } ? D : T;

export type ApiResponseData<
  P extends keyof paths,
  M extends HttpMethod = PrimaryMethod<P>,
> = UnwrapApiEnvelope<JsonResponseContent<P, M>>;

export interface InvalidParam {
  name: string;
  reason: string;
}

export interface Rfc9457ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  code?: string;
  traceId?: string;
  invalidParams?: InvalidParam[];
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PagedResponse<TItem> {
  data: TItem[];
  meta: PageMeta;
}
