import { Inject, Injectable } from '@nestjs/common';

import type { AuthContext, ClientInfo } from '@/common/index.js';
import {
  ResourceConflictError,
  ResourceNotFoundError,
  UnauthenticatedError,
} from '@/core/errors/index.js';
import { MailService } from '@/core/mail/mail.service.js';

import { AuthCookieFactory } from './auth-cookie.factory.js';
import {
  AuthResult,
  type AuthBody,
  type ChangePasswordResponse,
  type ForgotPasswordResponse,
  type PublicUser,
  type RegisterResponse,
  type ResendOtpResponse,
  type ResetPasswordResponse,
  type VerifyEmailResponse,
} from './auth.types.js';
import type {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/index.js';
import { OtpService } from './otp.service.js';
import { SessionService, type IssuedSession } from './session.service.js';
import { UserDirectory } from './user-directory.service.js';

/**
 * Orchestrates the auth endpoints. Deliberately thin: every decision of
 * substance lives in `UserDirectory` (who you are), `SessionService` (what your
 * login is worth) or `AuthCookieFactory` (how the browser is told).
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(UserDirectory) private readonly users: UserDirectory,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(AuthCookieFactory) private readonly cookies: AuthCookieFactory,
    @Inject(OtpService) private readonly otpService: OtpService,
    @Inject(MailService) private readonly mailService: MailService,
  ) {}

  async login(dto: LoginDto, client: ClientInfo): Promise<AuthResult<AuthBody>> {
    const user = await this.users.authenticate(dto);
    const issued = await this.sessions.issue({ user, client });

    return this.deliver(user, issued, client);
  }

  async register(dto: RegisterDto): Promise<RegisterResponse> {
    // Check Cooldown 60s to prevent spamming email
    await this.otpService.assertCanResend(dto.email);

    // Save/Update info into DB
    const user = await this.users.registerUser(dto);

    // Generate OTP 6 digits save to Redis
    const otp = await this.otpService.generateAndStoreOtp(user.email);

    // Send email to verify
    void this.mailService.sendOtpMail({
      toEmail: user.email,
      recipientName: user.fullName,
      otp,
      ttlMinutes: 5,
    });

    return {
      email: user.email,
      message: 'Please verify your email to activate your account within 5 minutes.',
      expiresInSeconds: 300,
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<VerifyEmailResponse> {
    // Check OTP in Redis
    await this.otpService.verifyOtp(dto.email, dto.otp);

    // Activate account in DB
    const user = await this.users.activateEmail(dto.email);

    return {
      user,
      message: 'Account activated successfully. You can login now.',
    };
  }

  async resendOtp(dto: ResendOtpDto): Promise<ResendOtpResponse> {
    // Check account in DB
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      throw new ResourceNotFoundError('Account', dto.email);
    }
    if (user.isEmailVerified) {
      throw new ResourceConflictError('Email has been verified already.');
    }

    // Generate new OTP
    const otp = await this.otpService.generateAndStoreOtp(user.email);

    // Send email to verify
    void this.mailService.sendOtpMail({
      toEmail: user.email,
      recipientName: user.fullName,
      otp,
      ttlMinutes: 5,
    });

    return {
      email: user.email,
      message: 'New OTP code has been sent to your email',
      cooldownSeconds: 60,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    const user = await this.users.findByEmail(dto.email);

    if (user && user.isEmailVerified && user.isActive) {
      const otp = await this.otpService.generateResetPasswordOtp(user.email);
      await this.mailService.sendResetPasswordMail({
        toEmail: user.email,
        recipientName: user.fullName,
        otp,
        ttlMinutes: 5,
      });
    }

    return {
      message: 'If this email address exists in our system, a password reset code has been sent.',
      expiresInSeconds: 300,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<ResetPasswordResponse> {
    await this.otpService.verifyResetPasswordOtp(dto.email, dto.otp);
    const userId = await this.users.resetPassword(dto.email, dto.newPassword);

    await this.sessions.revokeEverySession(userId);

    return { message: 'Password reset successfully. Please log in with your new password.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<ChangePasswordResponse> {
    await this.users.changePassword(userId, dto.currentPassword, dto.newPassword);
    await this.sessions.revokeEverySession(userId);

    return { message: 'Password changed successfully.' };
  }

  async refresh(
    presentedToken: string | undefined,
    client: ClientInfo,
  ): Promise<AuthResult<AuthBody>> {
    const issued = await this.sessions.rotate(presentedToken, client);

    return this.deliver(issued.user, issued, client);
  }

  async logout(
    presentedToken: string | undefined,
    actor: AuthContext | undefined,
  ): Promise<AuthResult<null>> {
    await this.sessions.revokeByRefreshToken(presentedToken);
    await this.revokeAccessToken(actor);

    return new AuthResult<null>(null, [], this.cookies.clearedNames());
  }

  async logoutAll(actor: AuthContext): Promise<AuthResult<null>> {
    await this.sessions.revokeEverySession(actor.id);
    await this.revokeAccessToken(actor);

    return new AuthResult<null>(null, [], this.cookies.clearedNames());
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.users.findActive(userId);
    if (user === undefined) throw new UnauthenticatedError('Account is no longer active');

    return user;
  }

  /**
   * Mobile has a hardware keystore and no cookie jar; the browser has a cookie
   * jar and nowhere safe for JavaScript to keep a long-lived secret. Those are
   * the only two answers, and they are not interchangeable.
   */
  private deliver(
    user: PublicUser,
    issued: IssuedSession,
    client: ClientInfo,
  ): AuthResult<AuthBody> {
    if (client.isMobile) {
      return new AuthResult<AuthBody>({
        accessToken: issued.accessToken,
        user,
        refreshToken: issued.refreshToken,
      });
    }

    const csrfToken = this.sessions.issueCsrfToken();

    return new AuthResult<AuthBody>({ accessToken: issued.accessToken, user, csrfToken }, [
      this.cookies.refresh(issued.refreshToken, issued.refreshTtlMs),
      this.cookies.csrf(csrfToken, issued.refreshTtlMs),
    ]);
  }

  private async revokeAccessToken(actor: AuthContext | undefined): Promise<void> {
    if (actor !== undefined) await this.sessions.revokeAccessToken(actor.jti);
  }
}
