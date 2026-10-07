export type HealthPath = '/healthz';

export type { components, operations, paths } from './generated.js';

export function getHealthPath(): HealthPath {
  return '/healthz';
}
