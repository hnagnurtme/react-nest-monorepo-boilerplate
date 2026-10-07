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

import { CreateUserDto, ListUsersDto, SetUserRolesDto, UpdateUserDto } from './dto/index.js';
import { ApiUserListResponse, ApiUserResponse } from './users.openapi.js';
import { UsersService } from './users.service.js';
import type { UserResponse } from './users.types.js';

const { UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY } = HttpStatus;

@ApiTags('users')
@ApiBearerAuth(ACCESS_TOKEN_SECURITY_SCHEME)
@Controller({ path: 'users', version: '1' })
@UseGuards(PoliciesGuard)
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'User'))
  @ApiOperation({
    summary: 'List users visible to the caller (own tenant; all for platform admin)',
  })
  @ApiUserListResponse('A page of users')
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, UNPROCESSABLE_ENTITY)
  list(@Query() query: ListUsersDto): Promise<{ items: UserResponse[]; meta: PaginationMeta }> {
    return this.users.list(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can('create', 'User'))
  @ApiOperation({
    summary: 'Create a user (admins only; there is no self sign-up)',
  })
  @ApiUserResponse('The created user', HttpStatus.CREATED)
  @ApiBody({ type: CreateUserDto })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, CONFLICT, UNPROCESSABLE_ENTITY)
  async create(
    @CurrentUser() actor: AuthContext,
    @Body() dto: CreateUserDto,
    // Only the Location header is set here; the body still flows through the
    // global envelope interceptor.
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse> {
    const created = await this.users.create(actor, dto);
    response.setHeader('Location', `/api/v1/users/${created.id}`);
    return created;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one user' })
  @ApiUserResponse('The user')
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  get(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponse> {
    return this.users.findOrThrow(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user profile (admins may also activate or deactivate)' })
  @ApiUserResponse('The updated user')
  @ApiBody({ type: UpdateUserDto })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND, UNPROCESSABLE_ENTITY)
  update(
    @CurrentUser() actor: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponse> {
    return this.users.update(actor, id, dto);
  }

  @Put(':id/roles')
  @ApiOperation({
    summary: 'Replace the roles of a user (never your own, never more than you hold)',
  })
  @ApiBody({ type: SetUserRolesDto })
  @ApiUserResponse('The user with its new roles')
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY)
  setRoles(
    @CurrentUser() actor: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserRolesDto,
  ): Promise<UserResponse> {
    return this.users.setRoles(actor, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a user' })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  remove(@CurrentUser() actor: AuthContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.users.remove(actor, id);
  }
}
