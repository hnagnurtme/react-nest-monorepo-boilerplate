import { Module } from '@nestjs/common';

import { AdministrativeUnitsController } from './administrative-units.controller.js';
import { AdministrativeUnitsRepository } from './administrative-units.repository.js';
import { AdministrativeUnitsService } from './administrative-units.service.js';

@Module({
  controllers: [AdministrativeUnitsController],
  providers: [AdministrativeUnitsService, AdministrativeUnitsRepository],
  /* `TenantsService` validates an address against the catalog. */
  exports: [AdministrativeUnitsService],
})
export class AdministrativeUnitsModule {}
