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
export type UpdateUserBody = components['schemas']['UpdateUserDto'];
