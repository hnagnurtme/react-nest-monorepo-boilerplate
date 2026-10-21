import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import {
  ApiProblemResponses,
  CurrentUser,
  NoTenantContext,
  PlatformWide,
  type AuthContext,
  type PaginationMeta,
} from '@/common/index.js';
import { CheckPolicies, PoliciesGuard } from '@/core/guards/index.js';
import { ACCESS_TOKEN_SECURITY_SCHEME } from '@/modules/auth/index.js';

import {
  CreateTenantDto,
  ListTenantsDto,
  LogoUploadEnvelopeDto,
  LogoUploadUrlDto,
  TenantEnvelopeDto,
  TenantListEnvelopeDto,
  TenantPickerEnvelopeDto,
  UpdateTenantDto,
} from './dto/index.js';
import { TenantsService } from './tenants.service.js';
import type { LogoUploadResponse, TenantResponse } from './tenants.types.js';

const { UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY } = HttpStatus;

/**
 * `@PlatformWide()`: these endpoints are about tenants rather than inside one.
 * Under a single tenant's policies the full list is invisible and a tenant
 * cannot be created at all.
 */
@ApiTags('tenants')
@ApiBearerAuth(ACCESS_TOKEN_SECURITY_SCHEME)
@Controller({ path: 'tenants', version: '1' })
@UseGuards(PoliciesGuard)
@PlatformWide()
export class TenantsController {
  constructor(@Inject(TenantsService) private readonly tenants: TenantsService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Tenant'))
  @ApiOperation({
    summary: 'List tenants visible to the caller (own tenant; all for platform admin)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'A page of tenants',
    type: TenantListEnvelopeDto,
  })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, UNPROCESSABLE_ENTITY)
  list(@Query() query: ListTenantsDto): Promise<{ items: TenantResponse[]; meta: PaginationMeta }> {
    return this.tenants.list(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can('create', 'Tenant'))
  @ApiOperation({ summary: 'Create a tenant (platform admin only)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The created tenant',
    type: TenantEnvelopeDto,
  })
  @ApiBody({ type: CreateTenantDto })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, CONFLICT, UNPROCESSABLE_ENTITY)
  async create(
    @CurrentUser() actor: AuthContext,
    @Body() dto: CreateTenantDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TenantResponse> {
    const created = await this.tenants.create(actor, dto);
    response.setHeader('Location', `/api/v1/tenants/${created.id}`);
    return created;
  }

  /** Declared before `:id` so the literal path is not parsed as a uuid. */
  @Get('mine')
  @NoTenantContext()
  @ApiOperation({
    summary: 'Every tenant the caller may act in — the tenant picker',
    description:
      'Answers before a tenant has been chosen, so it needs no x-tenant-id header. ' +
      'Membership comes from the database-loaded profile; a platform account gets ' +
      'every active tenant.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "The caller's tenants, ordered by name",
    type: TenantPickerEnvelopeDto,
  })
  @ApiProblemResponses(UNAUTHORIZED)
  listMine(@CurrentUser() actor: AuthContext): Promise<TenantResponse[]> {
    return this.tenants.listMine(actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one tenant' })
  @ApiResponse({ status: HttpStatus.OK, description: 'The tenant', type: TenantEnvelopeDto })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  get(@Param('id', ParseUUIDPipe) id: string): Promise<TenantResponse> {
    return this.tenants.findOrThrow(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tenant (platform admin may also activate or deactivate)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The updated tenant',
    type: TenantEnvelopeDto,
  })
  @ApiBody({ type: UpdateTenantDto })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND, UNPROCESSABLE_ENTITY)
  update(
    @CurrentUser() actor: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ): Promise<TenantResponse> {
    return this.tenants.update(actor, id, dto);
  }

  /**
   * Signs a PUT so the browser uploads straight to the bucket; the file never
   * passes through NestJS. `PATCH /tenants/:id` with `detail.logoObjectKey`
   * then confirms the key, which is what stops a caller from storing one it
   * never uploaded to.
   */
  @Post(':id/logo/upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign an upload for a tenant logo' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The signed PUT and the key to confirm',
    type: LogoUploadEnvelopeDto,
  })
  @ApiBody({ type: LogoUploadUrlDto })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND, UNPROCESSABLE_ENTITY)
  signLogoUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LogoUploadUrlDto,
  ): Promise<LogoUploadResponse> {
    return this.tenants.signLogoUpload(id, dto.contentType);
  }
}
