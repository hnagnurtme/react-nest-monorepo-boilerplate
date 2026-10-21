import type { DirectoryTenant } from '@/entities/tenant';
import { type TENANT_ENDPOINTS } from '@/features/tenants/endpoints';
import type { ApiRequestBody, ApiResponseData, PageMeta } from '@/lib/http/types';

/** Tenant as returned by the tenants endpoints (typed by the API contract). */
export type Tenant = ApiResponseData<typeof TENANT_ENDPOINTS.TENANTS, 'get'>[number];

export interface TenantsPageData {
  items: Tenant[];
  meta: PageMeta;
}

export type CreateTenantBody = ApiRequestBody<typeof TENANT_ENDPOINTS.TENANTS, 'post'>;
export type UpdateTenantBody = ApiRequestBody<typeof TENANT_ENDPOINTS.TENANT, 'patch'>;

/** A tenant on the picker, with the logo and address it draws. */
export type MyTenant = DirectoryTenant;

/** The address block: null on a tenant nobody has filled the form in for. */
export type TenantDetail = NonNullable<Tenant['detail']>;

export type AdministrativeUnit = ApiResponseData<typeof TENANT_ENDPOINTS.PROVINCES, 'get'>[number];

export type LogoUpload = ApiResponseData<typeof TENANT_ENDPOINTS.LOGO_UPLOAD_URL, 'post'>;
export type LogoUploadBody = ApiRequestBody<typeof TENANT_ENDPOINTS.LOGO_UPLOAD_URL, 'post'>;
