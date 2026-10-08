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
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, seconds } from '@nestjs/throttler';

import { ApiProblemResponses, CurrentUser, Public, type AuthContext } from '@/common/index.js';
import { CheckPolicies, PoliciesGuard } from '@/core/guards/index.js';
import { ACCESS_TOKEN_SECURITY_SCHEME } from '@/modules/auth/index.js';

import {
  AcceptTenantInvitationDto,
  InviteToTenantDto,
  TenantInvitationListEnvelopeDto,
  TenantInvitationPreviewEnvelopeDto,
} from './dto/index.js';
import { UsersService } from './users.service.js';
import type { TenantInvitationPreview, TenantInvitationSummary } from './users.types.js';

const { UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY } = HttpStatus;
/** Same budget as the other token endpoints: these take an emailed credential. */
const TOKEN_LIMIT = 5;
const WINDOW_SECONDS = 60;

/**
 * Inviting an account that already exists into a tenant.
 *
 * An email is one account platform-wide, so joining a second tenant is an
 * invitation the account accepts — not something a tenant admin does to it.
 * `POST /users` answers `ACCOUNT_ALREADY_EXISTS` and the client comes here.
 *
 * The two public routes sit under fixed path segments (`token/…`, `accept`) so
 * they can never be read as an invitation id.
 */
@ApiTags('users')
@Controller({ path: 'tenant-invitations', version: '1' })
export class TenantInvitationsController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get('token/:token')
  @Public()
  @Throttle({ default: { limit: TOKEN_LIMIT, ttl: seconds(WINDOW_SECONDS) } })
  @ApiOperation({ summary: 'What an invitation link is offering, for the acceptance screen' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The invitation',
    type: TenantInvitationPreviewEnvelopeDto,
  })
  @ApiProblemResponses(NOT_FOUND, UNPROCESSABLE_ENTITY)
  preview(@Param('token') token: string): Promise<TenantInvitationPreview> {
    return this.users.previewTenantInvitation(token);
  }

  @Post('accept')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: TOKEN_LIMIT, ttl: seconds(WINDOW_SECONDS) } })
  @ApiOperation({ summary: 'Accept an invitation to join a tenant' })
  @ApiBody({ type: AcceptTenantInvitationDto })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'The account joined the tenant' })
  @ApiProblemResponses(NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY)
  async accept(@Body() dto: AcceptTenantInvitationDto): Promise<void> {
    await this.users.acceptTenantInvitation(dto.token);
  }

  @Get()
  @UseGuards(PoliciesGuard)
  @ApiBearerAuth(ACCESS_TOKEN_SECURITY_SCHEME)
  @CheckPolicies((ability) => ability.can('read', 'User'))
  @ApiOperation({ summary: 'Invitations still waiting on their invitee' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pending invitations',
    type: TenantInvitationListEnvelopeDto,
  })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN)
  listPending(@CurrentUser() actor: AuthContext): Promise<TenantInvitationSummary[]> {
    return this.users.listPendingInvitations(actor);
  }

  @Post()
  @UseGuards(PoliciesGuard)
  @ApiBearerAuth(ACCESS_TOKEN_SECURITY_SCHEME)
  @HttpCode(HttpStatus.ACCEPTED)
  @CheckPolicies((ability) => ability.can('create', 'User'))
  @ApiOperation({ summary: 'Invite an existing account to join the tenant' })
  @ApiBody({ type: InviteToTenantDto })
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The invitation was emailed' })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY)
  invite(@CurrentUser() actor: AuthContext, @Body() dto: InviteToTenantDto): Promise<void> {
    return this.users.inviteToTenant(actor, dto);
  }

  @Post(':id/resend')
  @UseGuards(PoliciesGuard)
  @ApiBearerAuth(ACCESS_TOKEN_SECURITY_SCHEME)
  @HttpCode(HttpStatus.ACCEPTED)
  @CheckPolicies((ability) => ability.can('create', 'User'))
  @ApiOperation({ summary: 'Email a fresh link for a pending invitation' })
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The invitation was emailed again' })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY)
  resend(@CurrentUser() actor: AuthContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.users.resendInvitationToTenant(actor, id);
  }

  @Delete(':id')
  @UseGuards(PoliciesGuard)
  @ApiBearerAuth(ACCESS_TOKEN_SECURITY_SCHEME)
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPolicies((ability) => ability.can('create', 'User'))
  @ApiOperation({ summary: 'Withdraw a pending invitation' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'The invitation was withdrawn' })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY)
  revoke(@CurrentUser() actor: AuthContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.users.revokeInvitation(actor, id);
  }
}
