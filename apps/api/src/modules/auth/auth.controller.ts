import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, seconds } from '@nestjs/throttler';

import { packAbility, type PackedRules } from '@repo/shared-types';

import {
  ApiProblemResponses,
  ClientInfoParam,
  CurrentUser,
  Public,
  type AuthContext,
  type ClientInfo,
} from '@/common/index.js';
import { AuthzService } from '@/core/authz/index.js';

import { AuthCookieInterceptor } from './auth-cookie.interceptor.js';
import { ACCESS_TOKEN_SECURITY_SCHEME } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type {
  AuthBody,
  AuthResult,
  ChangePasswordResponse,
  ForgotPasswordResponse,
  PublicUser,
  ResetPasswordResponse,
} from './auth.types.js';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  ResetPasswordDto,
  AbilitiesEnvelopeDto,
  AuthBodyEnvelopeDto,
  ForgotPasswordEnvelopeDto,
  MessageEnvelopeDto,
  PublicUserEnvelopeDto,
} from './dto/index.js';
import { RefreshCookie } from './refresh-token.decorator.js';

const LOGIN_LIMIT = 5;
const REFRESH_LIMIT = 30;
const WINDOW_SECONDS = 60;
const OTP_LIMIT = 5;

const { UNAUTHORIZED, FORBIDDEN, UNPROCESSABLE_ENTITY, TOO_MANY_REQUESTS, BAD_REQUEST, NOT_FOUND } =
  HttpStatus;

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
@UseInterceptors(AuthCookieInterceptor)
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuthzService) private readonly authz: AuthzService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: LOGIN_LIMIT, ttl: seconds(WINDOW_SECONDS) } })
  @ApiOperation({ summary: 'Exchange credentials for a token pair' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Authenticated', type: AuthBodyEnvelopeDto })
  @ApiProblemResponses(FORBIDDEN, UNAUTHORIZED, UNPROCESSABLE_ENTITY, TOO_MANY_REQUESTS)
  login(
    @Body() dto: LoginDto,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<AuthResult<AuthBody>> {
    return this.auth.login(dto, client);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: REFRESH_LIMIT, ttl: seconds(WINDOW_SECONDS) } })
  @ApiOperation({ summary: 'Rotate a refresh token for a new pair' })
  @ApiBody({ type: RefreshDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Rotated', type: AuthBodyEnvelopeDto })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, UNPROCESSABLE_ENTITY, TOO_MANY_REQUESTS)
  refresh(
    @Body() dto: RefreshDto,
    @RefreshCookie() cookieToken: string | undefined,
    @ClientInfoParam() client: ClientInfo,
  ): Promise<AuthResult<AuthBody>> {
    return this.auth.refresh(dto.refreshToken ?? cookieToken, client);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: OTP_LIMIT, ttl: seconds(WINDOW_SECONDS) } })
  @ApiOperation({ summary: 'Request password reset OTP via email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset code sent',
    type: ForgotPasswordEnvelopeDto,
  })
  @ApiProblemResponses(UNPROCESSABLE_ENTITY, TOO_MANY_REQUESTS)
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    return this.auth.forgotPassword(dto);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: OTP_LIMIT, ttl: seconds(WINDOW_SECONDS) } })
  @ApiOperation({ summary: 'Reset password using OTP code' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset successful',
    type: MessageEnvelopeDto,
  })
  @ApiProblemResponses(BAD_REQUEST, NOT_FOUND, UNPROCESSABLE_ENTITY, TOO_MANY_REQUESTS)
  resetPassword(@Body() dto: ResetPasswordDto): Promise<ResetPasswordResponse> {
    return this.auth.resetPassword(dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth(ACCESS_TOKEN_SECURITY_SCHEME)
  @ApiOperation({ summary: 'Change password for currently authenticated user' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password changed successfully',
    type: MessageEnvelopeDto,
  })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, UNPROCESSABLE_ENTITY)
  changePassword(
    @CurrentUser() actor: AuthContext,
    @Body() dto: ChangePasswordDto,
  ): Promise<ChangePasswordResponse> {
    return this.auth.changePassword(actor.id, dto);
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current login' })
  @ApiBody({ type: RefreshDto })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Session revoked' })
  @ApiProblemResponses(FORBIDDEN, UNPROCESSABLE_ENTITY)
  logout(
    @Body() dto: RefreshDto,
    @RefreshCookie() cookieToken: string | undefined,
    @CurrentUser() actor: AuthContext | undefined,
  ): Promise<AuthResult<null>> {
    return this.auth.logout(dto.refreshToken ?? cookieToken, actor);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth(ACCESS_TOKEN_SECURITY_SCHEME)
  @ApiOperation({ summary: 'Revoke every login of the current user' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'All sessions revoked' })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN)
  logoutAll(@CurrentUser() actor: AuthContext): Promise<AuthResult<null>> {
    return this.auth.logoutAll(actor);
  }

  @Get('me')
  @ApiBearerAuth(ACCESS_TOKEN_SECURITY_SCHEME)
  @ApiOperation({ summary: 'The currently authenticated user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'The caller', type: PublicUserEnvelopeDto })
  @ApiProblemResponses(UNAUTHORIZED)
  me(@CurrentUser() actor: AuthContext): Promise<PublicUser> {
    return this.auth.getProfile(actor.id);
  }

  @Get('me/abilities')
  @ApiBearerAuth(ACCESS_TOKEN_SECURITY_SCHEME)
  @ApiOperation({
    summary: "The caller's permissions as packed CASL rules, for the client to build its ability",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Packed CASL rules',
    type: AbilitiesEnvelopeDto,
  })
  @ApiProblemResponses(UNAUTHORIZED)
  abilities(): { rules: PackedRules } {
    return { rules: packAbility(this.authz.current()) };
  }
}
