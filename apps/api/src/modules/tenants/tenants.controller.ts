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

import { CreateTenantDto, ListTenantsDto, UpdateTenantDto } from './dto/index.js';
import { ApiTenantListResponse, ApiTenantResponse } from './tenants.openapi.js';
import { TenantsService } from './tenants.service.js';
import type { TenantResponse } from './tenants.types.js';

const { UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY } = HttpStatus;

@ApiTags('tenants')
@ApiBearerAuth(ACCESS_TOKEN_SECURITY_SCHEME)
@Controller({ path: 'tenants', version: '1' })
@UseGuards(PoliciesGuard)
export class TenantsController {
  constructor(@Inject(TenantsService) private readonly tenants: TenantsService) {}

  @Get()
  @CheckPolicies((ability) => ability.can('read', 'Tenant'))
  @ApiOperation({
    summary: 'List tenants visible to the caller (own tenant; all for platform admin)',
  })
  @ApiTenantListResponse('A page of tenants')
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, UNPROCESSABLE_ENTITY)
  list(@Query() query: ListTenantsDto): Promise<{ items: TenantResponse[]; meta: PaginationMeta }> {
    return this.tenants.list(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies((ability) => ability.can('create', 'Tenant'))
  @ApiOperation({ summary: 'Create a tenant (platform admin only)' })
  @ApiTenantResponse('The created tenant', HttpStatus.CREATED)
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

  @Get(':id')
  @ApiOperation({ summary: 'Get one tenant' })
  @ApiTenantResponse('The tenant')
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND)
  get(
    @CurrentUser() actor: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TenantResponse> {
    return this.tenants.findOrThrow(actor, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tenant (platform admin may also activate or deactivate)' })
  @ApiTenantResponse('The updated tenant')
  @ApiBody({ type: UpdateTenantDto })
  @ApiProblemResponses(UNAUTHORIZED, FORBIDDEN, NOT_FOUND, UNPROCESSABLE_ENTITY)
  update(
    @CurrentUser() actor: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
  ): Promise<TenantResponse> {
    return this.tenants.update(actor, id, dto);
  }
}
