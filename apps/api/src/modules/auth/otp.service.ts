import { createHash, randomInt } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { InvalidOtpError, OtpCooldownActiveError } from '@/core/errors/app.error.js';
import { RedisService } from '@/core/redis/index.js';

const OTP_PREFIX = 'auth:email-otp:';
const OTP_COOLDOWN_PREFIX = 'auth:email-otp-cooldown:';
const OTP_ATTEMPTS_PREFIX = 'auth:email-otp-attempts:';
const RESET_OTP_PREFIX = 'auth:reset-otp:';
const RESET_OTP_COOLDOWN_PREFIX = 'auth:reset-otp-cooldown:';

const OTP_COOLDOWN_SECONDS = 60;
const OTP_TTL_SECONDS = 300;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  /**
   * Generate a random 6-digit OTP code and save in Redis and Cooldown
   */
  async generateAndStoreOtp(email: string): Promise<string> {
    const hashedEmail = hashKey(email);
    const cooldownKey = `${OTP_COOLDOWN_PREFIX}${hashedEmail}`;

    // Check cooldown 60s
    const isCooldownActive = await this.redis.exists(cooldownKey);
    if (isCooldownActive) {
      throw new OtpCooldownActiveError(OTP_COOLDOWN_SECONDS);
    }

    // Generate random 6 digit OTP
    const otp = randomInt(100_000, 1_000_000).toString();
    const otpHash = hashKey(otp);

    const otpKey = `${OTP_PREFIX}${hashedEmail}`;
    const attemptsKey = `${OTP_ATTEMPTS_PREFIX}${hashedEmail}`;

    // Save hash OTP with TTL 5 minutes
    await this.redis.setWithTtl(otpKey, otpHash, OTP_TTL_SECONDS);

    // Set cooldown 60s
    await this.redis.setWithTtl(cooldownKey, '1', OTP_COOLDOWN_SECONDS);

    // Reset attempts counter
    await this.redis.delete(attemptsKey);

    return otp;
  }

  /**
   * Verify OTP code:
   * - If true: Delete OTP
   * - If false: Increment attempt counter
   *  - If attempts >= 5, delete OTP and cooldown.
   */
  async verifyOtp(email: string, candidateOtp: string): Promise<boolean> {
    const hashedEmail = hashKey(email);
    const otpKey = `${OTP_PREFIX}${hashedEmail}`;
    const attemptsKey = `${OTP_ATTEMPTS_PREFIX}${hashedEmail}`;

    const storedOtpHash = await this.redis.get(otpKey);
    if (storedOtpHash === null) {
      throw new InvalidOtpError('OTP code is invalid or expired');
    }

    // Check the number of failed attempts.
    const attempts = await this.redis.increment(attemptsKey);
    if (attempts === 1) await this.redis.expire(attemptsKey, OTP_TTL_SECONDS);

    if (attempts > MAX_OTP_ATTEMPTS) {
      await this.redis.delete(otpKey);
      await this.redis.delete(attemptsKey);
      throw new InvalidOtpError('Too many invalid attempts. Please try again later.');
    }

    const candidateHash = hashKey(candidateOtp);
    if (candidateHash !== storedOtpHash) {
      throw new InvalidOtpError('OTP code is invalid or expired.');
    }

    // Verify successfully => delete OTP immediately
    await this.redis.delete(otpKey);
    await this.redis.delete(attemptsKey);

    return true;
  }

  /**
   * Generate reset password OTP code
   */
  async generateResetPasswordOtp(email: string): Promise<string> {
    const hashedEmail = hashKey(email);
    const cooldownKey = `${RESET_OTP_COOLDOWN_PREFIX}${hashedEmail}`;

    const isCooldownActive = await this.redis.exists(cooldownKey);
    if (isCooldownActive) {
      throw new OtpCooldownActiveError(OTP_COOLDOWN_SECONDS);
    }

    const otp = randomInt(100_000, 1_000_000).toString();
    const otpHash = hashKey(otp);

    const otpKey = `${RESET_OTP_PREFIX}${hashedEmail}`;
    await this.redis.setWithTtl(otpKey, otpHash, OTP_TTL_SECONDS);
    await this.redis.setWithTtl(cooldownKey, '1', OTP_COOLDOWN_SECONDS);

    return otp;
  }

  /**
   * Verify OTP code reset password and remove immediately after success verification
   */
  async verifyResetPasswordOtp(email: string, candidateOtp: string): Promise<boolean> {
    const hashedEmail = hashKey(email);
    const otpKey = `${RESET_OTP_PREFIX}${hashedEmail}`;

    const storedOtpHash = await this.redis.get(otpKey);
    if (storedOtpHash === null) {
      throw new InvalidOtpError('Invalid or expired verification code.');
    }

    const candidateHash = hashKey(candidateOtp);
    if (candidateHash !== storedOtpHash) {
      throw new InvalidOtpError('Invalid or expired verification code.');
    }

    // Remove OTP immediately after success verification
    await this.redis.delete(otpKey);

    return true;
  }

  /**
   * Check cooldown allow resend code ?
   */
  async assertCanResend(email: string): Promise<void> {
    const hashedEmail = hashKey(email);
    const cooldownKey = `${OTP_COOLDOWN_PREFIX}${hashedEmail}`;

    const isCooldownActive = await this.redis.exists(cooldownKey);
    if (isCooldownActive) throw new OtpCooldownActiveError(OTP_COOLDOWN_SECONDS);
  }
}

function hashKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
