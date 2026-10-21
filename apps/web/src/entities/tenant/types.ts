import { type TENANT_DIRECTORY_ENDPOINTS } from '@/entities/tenant/endpoints';
import type { ApiResponseData } from '@/lib/http/types';

/** A tenant the caller may act in, with the logo and address the picker draws. */
export type DirectoryTenant = ApiResponseData<
  typeof TENANT_DIRECTORY_ENDPOINTS.MINE,
  'get'
>[number];
