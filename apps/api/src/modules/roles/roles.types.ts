import type { PermissionGrant, RoleScope } from '@repo/shared-types';

export interface RoleResponse {
  id: string;
  key: string;
  name: string;
  scope: RoleScope;
  isSystem: boolean;
  tenantId: string | null;
  permissions: PermissionGrant[];
}

export interface PermissionOption {
  action: string;
  subject: string;
  description: string;
  /** Reach levels the caller is allowed to hand out for this permission. */
  presets: string[];
}
