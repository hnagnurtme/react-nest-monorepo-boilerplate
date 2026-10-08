import type { components, operations } from '@repo/api-contract';

import type { PageMeta } from '@/lib/http/types';

type UserListBody =
  operations['UsersController_list_v1']['responses'][200]['content']['application/json'];

/** User row as returned by the users endpoints (typed by the API contract). */
export type UserListItem = UserListBody['data'][number];

export interface UsersPage {
  items: UserListItem[];
  meta: PageMeta;
}

export type CreateUserBody = components['schemas']['CreateUserDto'];
export type InviteToTenantBody = components['schemas']['InviteToTenantDto'];

type TenantInvitationPreviewBody =
  operations['TenantInvitationsController_preview_v1']['responses'][200]['content']['application/json'];

/** What an invitation link offers, for the acceptance screen. */
export type TenantInvitationPreview = TenantInvitationPreviewBody['data'];

type PendingInvitationsBody =
  operations['TenantInvitationsController_listPending_v1']['responses'][200]['content']['application/json'];

/** A pending invitation row in the admin UI. */
export type TenantInvitationSummary = PendingInvitationsBody['data'][number];
export type UpdateUserBody = components['schemas']['UpdateUserDto'];
export type SetUserRolesBody = components['schemas']['SetUserRolesDto'];
