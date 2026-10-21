import { Module } from '@nestjs/common';

import { StorageService } from './storage.service.js';

/**
 * The outbound adapter for object storage. It lives in `integrations/` because
 * `modules/` may not import a network SDK directly (eslint-plugin-boundaries).
 */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
