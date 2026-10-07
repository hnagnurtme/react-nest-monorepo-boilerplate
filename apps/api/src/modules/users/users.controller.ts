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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  ApiProblemResponses,
  CurrentUser,
  type AuthContext,
  type PaginationMeta,
} from '@/common/index.js';
import { CheckPolicies, PoliciesGuard } from '@/core/guards/index.js';
import { ACCESS_TOKEN_SECURITY_SCHEME } from '@/modules/auth/index.js';

import { ListUsersDto, UpdateUserDto } from './dto/index.js';
import { ApiUserListResponse, ApiUserResponse } from './users.openapi.js';
import { UsersService } from './users.service.js';
import type { UserResponse } from './users.types.js';

const { UNAUTHORIZED, FORBIDDEN, NOT_FOUND, UNPROCESSABLE_ENTITY } = HttpStatus;

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

  @Get(':id')
  @ApiOperation({ summary: 'Get one user' })
  @ApiUserResponse('The user')
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  get(
    @CurrentUser() actor: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponse> {
    return this.users.findOrThrow(actor, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user profile (admins may also activate or deactivate)' })
  @ApiUserResponse('The updated user')
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND, UNPROCESSABLE_ENTITY)
  update(
    @CurrentUser() actor: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponse> {
    return this.users.update(actor, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a user' })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  remove(@CurrentUser() actor: AuthContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.users.remove(actor, id);
  }
}
