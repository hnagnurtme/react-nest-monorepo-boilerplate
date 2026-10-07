import type { components, operations } from '@repo/api-contract';

import type { PageMeta } from '@/lib/http/types';

type TenantListBody =
  operations['TenantsController_list_v1']['responses'][200]['content']['application/json'];

/** Tenant as returned by the tenants endpoints (typed by the API contract). */
export type Tenant = TenantListBody['data'][number];

export interface TenantsPageData {
  items: Tenant[];
  meta: PageMeta;
}

export type CreateTenantBody = components['schemas']['CreateTenantDto'];
export type UpdateTenantBody = components['schemas']['UpdateTenantDto'];
