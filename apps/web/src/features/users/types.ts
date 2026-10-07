import type { operations } from '@repo/api-contract';

import type { PageMeta } from '@/lib/http/types';

type AuthUser = NonNullable<
  operations['AuthController_login_v1']['responses'][200]['content']['application/json']['data']
>['user'];

/** User row as returned by GET /api/v1/users (public fields from the contract's user shape). */
export type UserListItem = AuthUser & {
  phoneNumber?: string | null;
  isActive?: boolean;
};

export interface UsersPage {
  items: UserListItem[];
  meta: PageMeta;
}
