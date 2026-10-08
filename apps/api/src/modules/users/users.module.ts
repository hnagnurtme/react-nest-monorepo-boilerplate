import { Module } from '@nestjs/common';

import { AuthModule } from '@/modules/auth/index.js';

import { TenantInvitationService } from './tenant-invitation.service.js';
import { TenantInvitationsController } from './tenant-invitations.controller.js';
import { TenantInvitationsRepository } from './tenant-invitations.repository.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule],
  controllers: [UsersController, TenantInvitationsController],
  providers: [UsersService, UsersRepository, TenantInvitationService, TenantInvitationsRepository],
  exports: [UsersService],
})
export class UsersModule {}
