import { Controller, Get, HttpStatus, Inject, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ApiProblemResponses } from '@/common/index.js';
import { ACCESS_TOKEN_SECURITY_SCHEME } from '@/modules/auth/index.js';

import { AdministrativeUnitsService } from './administrative-units.service.js';
import type { AdministrativeUnitResponse } from './administrative-units.types.js';
import { ProvinceListEnvelopeDto, WardListEnvelopeDto } from './dto/index.js';

/**
 * Reference data: the 34 provinces and their wards, as they stand after the
 * 1 July 2025 merger. There is no district level any more.
 *
 * No `@CheckPolicies` and no catalog permission entry — there is nothing to
 * authorize because there is nothing to write. Refreshing the list is a pull
 * request plus `just db-migrate`.
 *
 * Unpaginated on purpose: 34 provinces, and under 200 wards in the largest of
 * them. A page boundary in a form's second dropdown buys nothing.
 */
@ApiTags('administrative-units')
@ApiBearerAuth(ACCESS_TOKEN_SECURITY_SCHEME)
@Controller({ path: 'administrative-units', version: '1' })
export class AdministrativeUnitsController {
  constructor(
    @Inject(AdministrativeUnitsService) private readonly units: AdministrativeUnitsService,
  ) {}

  @Get('provinces')
  @ApiOperation({ summary: 'Every province and centrally-governed city' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The provinces, ordered by code',
    type: ProvinceListEnvelopeDto,
  })
  @ApiProblemResponses(HttpStatus.UNAUTHORIZED)
  listProvinces(): Promise<AdministrativeUnitResponse[]> {
    return this.units.listProvinces();
  }

  @Get('provinces/:code/wards')
  @ApiOperation({ summary: 'The wards of one province' })
  @ApiParam({ name: 'code', description: 'Province code, zero-padded to two digits' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The wards, ordered by code',
    type: WardListEnvelopeDto,
  })
  @ApiProblemResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  listWards(@Param('code') code: string): Promise<AdministrativeUnitResponse[]> {
    return this.units.listWards(code);
  }
}
