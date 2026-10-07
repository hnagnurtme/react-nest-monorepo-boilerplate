import type { HealthStatus } from '@repo/shared-types';

import { apiClient } from './client';
import { SYSTEM_ENDPOINTS } from './constants';

export async function getApiHealth(): Promise<HealthStatus> {
  const result = await apiClient.get(SYSTEM_ENDPOINTS.HEALTH);
  return result;
}
