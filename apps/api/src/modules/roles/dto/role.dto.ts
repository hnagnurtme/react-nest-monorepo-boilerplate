import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

import { ACTIONS, SCOPE_PRESETS } from '@repo/shared-types';

import { pageQuerySchema } from '@/common/index.js';

export class ListRolesDto extends createZodDto(pageQuerySchema) {}

const NAME = z.string().trim().min(2).max(60);

/** `manage` is reserved for system roles; a custom role lists concrete actions. */
const CUSTOM_ACTIONS = ACTIONS.filter((action) => action !== 'manage') as [
  (typeof ACTIONS)[number],
  ...(typeof ACTIONS)[number][],
];

const grantSchema = z
  .object({
    action: z.enum(CUSTOM_ACTIONS),
    subject: z.string().min(1).max(60),
    preset: z.enum(SCOPE_PRESETS),
  })
  .strict();

const permissionsSchema = z.array(grantSchema).max(100);

/** `tenantId` is for platform admins, who pick the tenant; tenant admins are pinned to their own. */
export const createRoleSchema = z
  .object({ name: NAME, tenantId: z.string().uuid().optional(), permissions: permissionsSchema })
  .strict();
export class CreateRoleDto extends createZodDto(createRoleSchema) {}

export const updateRoleSchema = z.object({ name: NAME }).strict();
export class UpdateRoleDto extends createZodDto(updateRoleSchema) {}

export const setRolePermissionsSchema = z.object({ permissions: permissionsSchema }).strict();
export class SetRolePermissionsDto extends createZodDto(setRolePermissionsSchema) {}
