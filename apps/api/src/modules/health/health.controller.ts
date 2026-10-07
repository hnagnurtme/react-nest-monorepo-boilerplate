import { Controller, Get, HttpCode, HttpStatus, Inject, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '@/common/index.js';
import { ServiceUnavailableError } from '@/core/errors/index.js';

import { HealthService, type ReadinessReport } from './health.service.js';

function unavailableDependencyNames(report: ReadinessReport): string {
  return report.dependencies
    .filter((dependency) => dependency.status === 'down')
    .map((dependency) => dependency.name)
    .join(', ');
}

@ApiTags('health')
@SkipThrottle()
// Version-neutral as well as prefix-excluded: an orchestrator probing
// `/api/v1/healthz` is one version bump away from watching a route that no
// longer exists.
@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}

  @Get('healthz')
  @Public()
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: HttpStatus.OK, description: 'The process is running' })
  getLiveness(): { service: string; status: 'ok' } {
    return this.health.getLiveness();
  }

  @Get('readyz')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness check' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Every dependency is reachable' })
  @ApiResponse({ status: HttpStatus.SERVICE_UNAVAILABLE, description: 'A dependency is down' })
  async getReadiness(): Promise<ReadinessReport> {
    const report = await this.health.getReadiness();
    if (report.status === 'degraded')
      throw new ServiceUnavailableError(unavailableDependencyNames(report));

    return report;
  }
}
