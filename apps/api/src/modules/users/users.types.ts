import type { z } from 'zod';

import type {
  tenantInvitationPreviewSchema,
  tenantInvitationSummarySchema,
  userResponseSchema,
  userRoleResponseSchema,
  userTenantResponseSchema,
} from './dto/index.js';

export type UserRoleResponse = z.infer<typeof userRoleResponseSchema>;

export type UserResponse = z.infer<typeof userResponseSchema>;

export type UserTenantResponse = z.infer<typeof userTenantResponseSchema>;

export type TenantInvitationPreview = z.infer<typeof tenantInvitationPreviewSchema>;

export type TenantInvitationSummary = z.infer<typeof tenantInvitationSummarySchema>;
