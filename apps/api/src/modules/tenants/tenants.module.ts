import { Module } from '@nestjs/common';

import { StorageModule } from '@/integrations/storage/index.js';
import { AdministrativeUnitsModule } from '@/modules/administrative-units/index.js';

import { TenantDetailsRepository } from './tenant-details.repository.js';
import { TenantsController } from './tenants.controller.js';
import { TenantsRepository } from './tenants.repository.js';
import { TenantsService } from './tenants.service.js';

@Module({
  /* The address is validated against the administrative-unit catalog, and the
     logo is signed through the object-storage adapter. */
  imports: [AdministrativeUnitsModule, StorageModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantsRepository, TenantDetailsRepository],
})
export class TenantsModule {}
