import type { components, operations } from '@repo/api-contract';

import type { PageMeta } from '@/lib/http/types';

type RoleListBody =
  operations['RolesController_list_v1']['responses'][200]['content']['application/json'];
type PermissionListBody =
  operations['RolesController_permissions_v1']['responses'][200]['content']['application/json'];

/** Role as returned by the roles endpoints (typed by the API contract). */
export type RoleItem = RoleListBody['data'][number];
export type RolePermission = RoleItem['permissions'][number];

/** A catalog entry the caller may put into a role. */
export type PermissionOption = PermissionListBody['data'][number];

export interface RolesPageData {
  items: RoleItem[];
  meta: PageMeta;
}

export type CreateRoleBody = components['schemas']['CreateRoleDto'];
export type UpdateRoleBody = components['schemas']['UpdateRoleDto'];
export type SetRolePermissionsBody = components['schemas']['SetRolePermissionsDto'];
/** The write-side permission shape (no `manage`). */
export type PermissionInput = SetRolePermissionsBody['permissions'][number];
