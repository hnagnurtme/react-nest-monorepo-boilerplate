export interface UserRoleResponse {
  id: string;
  key: string;
  name: string;
}

/** Whitelisted shape of a user in API responses (docs/rules/06-api-design.md C6). */
export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  roles: UserRoleResponse[];
  tenantId: string | null;
  isActive: boolean;
  createdAt: string;
}
