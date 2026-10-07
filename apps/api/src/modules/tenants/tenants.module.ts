import { Module } from '@nestjs/common';

import { TenantsController } from './tenants.controller.js';
import { TenantsRepository } from './tenants.repository.js';
import { TenantsService } from './tenants.service.js';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, TenantsRepository],
})
export class TenantsModule {}
