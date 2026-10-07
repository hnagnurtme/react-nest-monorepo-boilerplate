import { Module } from '@nestjs/common';

import { AuthCookieFactory } from './auth-cookie.factory.js';
import { AuthCookieInterceptor } from './auth-cookie.interceptor.js';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { CredentialsService } from './credentials.service.js';
import { OtpService } from './otp.service.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';
import { UserDirectory } from './user-directory.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    AuthCookieFactory,
    AuthCookieInterceptor,
    CredentialsService,
    SessionService,
    TokenService,
    UserDirectory,
    OtpService,
  ],
  // AuthRepository is deliberately absent: a repository is never a public
  // contract (docs/rules/02-backend-nestjs.md F2).
  exports: [AuthService, CredentialsService],
})
export class AuthModule {}
