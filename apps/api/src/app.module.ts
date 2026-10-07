import { Module } from '@nestjs/common';

import { CoreModule } from './core/core.module.js';
import { AuthModule } from './modules/auth/index.js';
import { HealthModule } from './modules/health/index.js';
import { RolesModule } from './modules/roles/index.js';
import { TenantsModule } from './modules/tenants/index.js';
import { UsersModule } from './modules/users/index.js';

/**
 * Composition root. Feature slices live under `src/modules` and are listed
 * here; `CoreModule` stays first so its global providers exist before any
 * module that injects them.
 */
@Module({
  imports: [CoreModule, HealthModule, AuthModule, RolesModule, TenantsModule, UsersModule],
})
export class AppModule {}
