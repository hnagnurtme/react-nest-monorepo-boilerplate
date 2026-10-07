export * from './authz/catalog.js';
export * from './authz/ability.js';

export { PROBLEM_CONTENT_TYPE } from './http/api-response.js';
export type {
  ApiResponse,
  InvalidParam,
  PaginationMeta,
  ProblemDetails,
} from './http/api-response.js';

export interface HealthStatus {
  service: string;
  status: 'ok';
}

export function createHealthStatus(service: string): HealthStatus {
  return { service, status: 'ok' };
}
