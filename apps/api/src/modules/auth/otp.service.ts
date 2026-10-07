import { createHash, randomInt } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import { InvalidOtpError, OtpCooldownActiveError } from '@/core/errors/app.error.js';
import { RedisService } from '@/core/redis/index.js';

const RESET_OTP_PREFIX = 'auth:reset-otp:';
const RESET_OTP_COOLDOWN_PREFIX = 'auth:reset-otp-cooldown:';

const OTP_COOLDOWN_SECONDS = 60;
const OTP_TTL_SECONDS = 300;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

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
}

function hashKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
