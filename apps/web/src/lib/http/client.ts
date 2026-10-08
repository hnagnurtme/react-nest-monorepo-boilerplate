import type { paths } from '@repo/api-contract';

import { env } from '@/config/env';

import { TENANT_HEADER_NAME } from './constants';
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  expireCsrfCookie,
  isCsrfFailure,
  isCsrfRecoverableEndpoint,
} from './csrf';
import { refreshSession, resetRefreshForTests } from './refresh';
import type {
  ApiRequestBody,
  ApiResponseData,
  InvalidParam,
  PagedResponse,
  Rfc9457ProblemDetails,
} from './types';

let tokenProvider: (() => string | null) | null = null;
let tenantProvider: (() => string | null) | null = null;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let unauthorizedHandler: (() => void) | null = null;

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Supplies the tenant every authenticated call acts in.
 *
 * An account can belong to several tenants, so the API refuses to guess: a
 * request without the header is rejected unless the endpoint is one of the few
 * that work before the choice is made.
 */
export function setTenantProvider(provider: () => string | null): void {
  tenantProvider = provider;
}

export function setTokenProvider(provider: () => string | null): void {
  tokenProvider = provider;
}

export function setUnauthorizedHandler(handler: () => void): void {
  // Handler is called by refreshSession flow in main.tsx
  // This function exists for consistency with main.tsx setup
  unauthorizedHandler = handler;
}

export const HTTP_STATUS = {
  OK: 200,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  UNPROCESSABLE_ENTITY: 422,
} as const;

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuthRefresh?: boolean;
  isRetry?: boolean;
  isCsrfRetry?: boolean;
}

export interface ApiErrorOptions {
  invalidParams?: InvalidParam[];
  details?: Rfc9457ProblemDetails;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly invalidParams?: InvalidParam[] | undefined;
  public readonly details?: Rfc9457ProblemDetails | undefined;

  constructor(
    message: string,
    options: {
      status: number;
      code: string;
      invalidParams?: InvalidParam[] | undefined;
      details?: Rfc9457ProblemDetails | undefined;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.invalidParams = options.invalidParams;
    this.details = options.details;
  }
}

function buildUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const baseUrl = env.VITE_API_URL.replace(/\/$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  let url = `${baseUrl}${cleanEndpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }
  return url;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const encodedName = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(encodedName) || entry.startsWith(`${name}=`));

  if (cookie === undefined) return null;

  const separatorIndex = cookie.indexOf('=');
  const value = separatorIndex === -1 ? '' : cookie.slice(separatorIndex + 1);
  return decodeURIComponent(value);
}

function isUnsafeMethod(method: string | undefined): boolean {
  return UNSAFE_METHODS.has((method ?? 'GET').toUpperCase());
}

function buildHeaders(headers?: HeadersInit, isFormData = false, method?: string): Headers {
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has('Content-Type') && !isFormData) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (isUnsafeMethod(method) && !requestHeaders.has(CSRF_HEADER_NAME)) {
    const csrfToken = readCookie(CSRF_COOKIE_NAME);
    if (csrfToken !== null) {
      requestHeaders.set(CSRF_HEADER_NAME, csrfToken);
    }
  }

  const token = tokenProvider ? tokenProvider() : null;
  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  if (!requestHeaders.has(TENANT_HEADER_NAME)) {
    const tenantId = tenantProvider ? tenantProvider() : null;
    if (tenantId) requestHeaders.set(TENANT_HEADER_NAME, tenantId);
  }
  return requestHeaders;
}

async function parsePayload(response: Response): Promise<unknown> {
  if (response.status === HTTP_STATUS.NO_CONTENT) {
    return undefined;
  }
  return response.json().catch(() => null);
}

function handleError(status: number, payload: unknown): never {
  const problem = (payload ?? {}) as Rfc9457ProblemDetails;
  const errorCode = problem.code ?? 'UNKNOWN_ERROR';
  const errorMessage = problem.detail ?? problem.title ?? 'Unknown error occurred';

  // Note: 401 handling moved to interceptor in rawRequest
  // unauthorizedHandler is now called by refreshHandler, not here

  throw new ApiError(errorMessage, {
    status,
    code: errorCode,
    invalidParams: problem.invalidParams,
    details: problem,
  });
}

/**
 * Raw HTTP request with 401 interceptor and automatic token refresh.
 * Returns the parsed response body without unwrapping the `{ data }` envelope.
 *
 * @throws {ApiError} on non-2xx responses
 */
async function requestPayload(endpoint: string, options: RequestOptions = {}): Promise<unknown> {
  const { params, headers, body, skipAuthRefresh, isRetry, isCsrfRetry, ...restOptions } = options;
  const url = buildUrl(endpoint, params);
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const requestHeaders = buildHeaders(headers, isFormData, restOptions.method);

  const fetchOptions: RequestInit = {
    ...restOptions,
    headers: requestHeaders,
    credentials: 'include',
  };
  if (body !== undefined) {
    fetchOptions.body = body;
  }

  const response = await fetch(url, fetchOptions);

  // Stale CSRF cookie from an earlier session: expire it and retry login/refresh once.
  if (!isCsrfRetry && isCsrfRecoverableEndpoint(endpoint) && (await isCsrfFailure(response))) {
    expireCsrfCookie();
    return requestPayload(endpoint, { ...options, isCsrfRetry: true });
  }

  // 401 Interceptor: attempt refresh and retry once
  if (response.status === HTTP_STATUS.UNAUTHORIZED && !skipAuthRefresh && !isRetry) {
    const outcome = await refreshSession();

    if (outcome.kind === 'refreshed') {
      // Retry with new token and CSRF (buildHeaders reads fresh cookies)
      return requestPayload(endpoint, { ...options, isRetry: true });
    }

    // Refresh failed: logout is handled by refreshHandler registered in main.tsx
    // Do NOT call unauthorizedHandler here to avoid calling it multiple times for concurrent requests
  }

  const payload = await parsePayload(response);

  if (!response.ok) {
    handleError(response.status, payload);
  }

  return payload;
}

/**
 * Raw HTTP request that unwraps the `{ data }` envelope.
 *
 * @throws {ApiError} on non-2xx responses
 */
export async function rawRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const payload = await requestPayload(endpoint, options);

  const result = payload as { data?: T } | T;
  if (result && typeof result === 'object' && 'data' in result && result.data !== undefined) {
    return result.data;
  }
  return result as T;
}

/**
 * Raw HTTP request for paginated endpoints: returns the full `{ data, meta }` envelope.
 *
 * @throws {ApiError} on non-2xx responses
 */
export async function rawPagedRequest<TItem>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<PagedResponse<TItem>> {
  const payload = await requestPayload(endpoint, { ...options, method: 'GET' });
  return payload as PagedResponse<TItem>;
}

export const apiClient = {
  get: <P extends keyof paths>(
    endpoint: P,
    options?: RequestOptions,
  ): Promise<ApiResponseData<P, 'get'>> =>
    rawRequest<ApiResponseData<P, 'get'>>(endpoint, { ...options, method: 'GET' }),

  post: <P extends keyof paths>(
    endpoint: P,
    body?: ApiRequestBody<P, 'post'>,
    options?: RequestOptions,
  ): Promise<ApiResponseData<P, 'post'>> =>
    rawRequest<ApiResponseData<P, 'post'>>(endpoint, {
      ...options,
      method: 'POST',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),

  put: <P extends keyof paths>(
    endpoint: P,
    body?: ApiRequestBody<P, 'put'>,
    options?: RequestOptions,
  ): Promise<ApiResponseData<P, 'put'>> =>
    rawRequest<ApiResponseData<P, 'put'>>(endpoint, {
      ...options,
      method: 'PUT',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),

  delete: <P extends keyof paths>(
    endpoint: P,
    options?: RequestOptions,
  ): Promise<ApiResponseData<P, 'delete'>> =>
    rawRequest<ApiResponseData<P, 'delete'>>(endpoint, { ...options, method: 'DELETE' }),
};

/**
 * Reset HTTP client state for tests.
 * @internal
 */
export function resetHttpClientForTests(): void {
  tokenProvider = null;
  tenantProvider = null;
  unauthorizedHandler = null;
  resetRefreshForTests();
}
