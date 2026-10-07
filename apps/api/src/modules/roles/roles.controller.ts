import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import {
  ApiProblemResponses,
  CurrentUser,
  type AuthContext,
  type PaginationMeta,
} from '@/common/index.js';
import { CheckPolicies, PoliciesGuard } from '@/core/guards/index.js';
import { ACCESS_TOKEN_SECURITY_SCHEME } from '@/modules/auth/index.js';

import { CreateRoleDto, ListRolesDto, SetRolePermissionsDto, UpdateRoleDto } from './dto/index.js';
import {
  ApiPermissionOptionsResponse,
  ApiRoleListResponse,
  ApiRoleResponse,
} from './roles.openapi.js';
import { RolesService } from './roles.service.js';
import type { PermissionOption, RoleResponse } from './roles.types.js';

const { UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY } = HttpStatus;

@ApiTags('roles')
@ApiBearerAuth(ACCESS_TOKEN_SECURITY_SCHEME)
@Controller({ version: '1' })
@UseGuards(PoliciesGuard)
export class RolesController {
  constructor(@Inject(RolesService) private readonly roles: RolesService) {}

  @Get('permissions')
  @CheckPolicies((ability) => ability.can('read', 'Role'))
  @ApiOperation({
    summary: 'Permissions the caller may put into a role (the catalog it already holds)',
  })
  @ApiPermissionOptionsResponse('Grantable permissions')
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN)
  permissions(): PermissionOption[] {
    return this.roles.grantable();
  }

  @Get('roles')
  @CheckPolicies((ability) => ability.can('read', 'Role'))
  @ApiOperation({ summary: "List roles: the shared system roles and the tenant's own" })
  @ApiRoleListResponse('A page of roles')
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, UNPROCESSABLE_ENTITY)
  list(@Query() query: ListRolesDto): Promise<{ items: RoleResponse[]; meta: PaginationMeta }> {
    return this.roles.list(query);
  }

  @Post('roles')
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can('create', 'Role'))
  @ApiOperation({ summary: 'Create a custom role in a tenant' })
  @ApiBody({ type: CreateRoleDto })
  @ApiRoleResponse('The created role', HttpStatus.CREATED)
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, CONFLICT, UNPROCESSABLE_ENTITY)
  async create(
    @CurrentUser() actor: AuthContext,
    @Body() dto: CreateRoleDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RoleResponse> {
    const created = await this.roles.create(actor, dto);
    response.setHeader('Location', `/api/v1/roles/${created.id}`);
    return created;
  }

  @Get('roles/:id')
  @ApiOperation({ summary: 'Get one role with its permissions' })
  @ApiRoleResponse('The role')
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  get(@Param('id', ParseUUIDPipe) id: string): Promise<RoleResponse> {
    return this.roles.findOrThrow(id);
  }

  @Patch('roles/:id')
  @ApiOperation({ summary: 'Rename a custom role (system roles are immutable)' })
  @ApiBody({ type: UpdateRoleDto })
  @ApiRoleResponse('The updated role')
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY)
  rename(
    @CurrentUser() actor: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponse> {
    return this.roles.rename(actor, id, dto);
  }

  @Put('roles/:id/permissions')
  @ApiOperation({ summary: 'Replace the permissions of a custom role (never more than you hold)' })
  @ApiBody({ type: SetRolePermissionsDto })
  @ApiRoleResponse('The role with its new permissions')
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND, UNPROCESSABLE_ENTITY)
  setPermissions(
    @CurrentUser() actor: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRolePermissionsDto,
  ): Promise<RoleResponse> {
    return this.roles.setPermissions(actor, id, dto);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a custom role that is not assigned to anyone' })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT)
  remove(@CurrentUser() actor: AuthContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.roles.remove(actor, id);
  }
}
