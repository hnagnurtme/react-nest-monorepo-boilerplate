import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { InvalidOtpError } from '@/core/errors/index.js';
import type { MailService } from '@/core/mail/index.js';
import type { AuthCookieFactory } from '@/modules/auth/auth-cookie.factory.js';
import { AuthService } from '@/modules/auth/auth.service.js';
import type { PublicUser } from '@/modules/auth/auth.types.js';
import type { OtpService } from '@/modules/auth/otp.service.js';
import type { SessionService } from '@/modules/auth/session.service.js';
import type { UserDirectory } from '@/modules/auth/user-directory.service.js';

interface MockUsers {
  authenticate: Mock;
  findByEmail: Mock;
  findActive: Mock;
  resetPassword: Mock;
  changePassword: Mock;
}

interface MockSessions {
  issue: Mock;
  rotate: Mock;
  revokeByRefreshToken: Mock;
  revokeEverySession: Mock;
  revokeAccessToken: Mock;
  issueCsrfToken: Mock;
}

interface MockOtpService {
  generateResetPasswordOtp: Mock;
  verifyResetPasswordOtp: Mock;
}

interface MockMailService {
  sendResetPasswordMail: Mock;
  sendMail: Mock;
}

describe('AuthService', () => {
  let authService: AuthService;
  let mockUsers: MockUsers;
  let mockSessions: MockSessions;
  let mockOtpService: MockOtpService;
  let mockMailService: MockMailService;

  const mockPublicUser: PublicUser = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    email: 'member@example.com',
    fullName: 'Jane Member',
    role: 'TENANT_MEMBER',
    tenantId: undefined,
  };

  beforeEach(() => {
    mockUsers = {
      authenticate: vi.fn(),
      findByEmail: vi.fn(),
      findActive: vi.fn(),
      resetPassword: vi.fn(),
      changePassword: vi.fn(),
    };

    mockSessions = {
      issue: vi.fn(),
      rotate: vi.fn(),
      revokeByRefreshToken: vi.fn(),
      revokeEverySession: vi.fn(),
      revokeAccessToken: vi.fn(),
      issueCsrfToken: vi.fn(),
    };

    mockOtpService = {
      generateResetPasswordOtp: vi.fn(),
      verifyResetPasswordOtp: vi.fn(),
    };

    mockMailService = {
      sendResetPasswordMail: vi.fn(),
      sendMail: vi.fn(),
    };

    authService = new AuthService(
      mockUsers as unknown as UserDirectory,
      mockSessions as unknown as SessionService,
      {} as unknown as AuthCookieFactory,
      mockOtpService as unknown as OtpService,
      mockMailService as unknown as MailService,
    );
  });

  describe('forgotPassword()', () => {
    it('gửi OTP khôi phục mật khẩu nếu email tồn tại và đã kích hoạt', async () => {
      mockUsers.findByEmail.mockResolvedValue({
        id: mockPublicUser.id,
        email: mockPublicUser.email,
        fullName: mockPublicUser.fullName,
        isEmailVerified: true,
        isActive: true,
      });
      mockOtpService.generateResetPasswordOtp.mockResolvedValue('888999');
      mockMailService.sendResetPasswordMail.mockResolvedValue(undefined);

      const res = await authService.forgotPassword({ email: mockPublicUser.email });

      expect(mockOtpService.generateResetPasswordOtp).toHaveBeenCalledWith(mockPublicUser.email);
      expect(mockMailService.sendResetPasswordMail).toHaveBeenCalledWith({
        toEmail: mockPublicUser.email,
        recipientName: mockPublicUser.fullName,
        otp: '888999',
        ttlMinutes: 5,
      });
      expect(res.expiresInSeconds).toBe(300);
    });

    it('không gửi mail nhưng vẫn trả về success message nếu email không tồn tại (chống dò email)', async () => {
      mockUsers.findByEmail.mockResolvedValue(undefined);

      const res = await authService.forgotPassword({ email: 'nonexistent@example.com' });

      expect(mockOtpService.generateResetPasswordOtp).not.toHaveBeenCalled();
      expect(mockMailService.sendResetPasswordMail).not.toHaveBeenCalled();
      expect(res.expiresInSeconds).toBe(300);
    });
  });

  describe('resetPassword()', () => {
    it('xác thực OTP -> cập nhật mật khẩu mới -> hủy tất cả session cũ', async () => {
      mockOtpService.verifyResetPasswordOtp.mockResolvedValue(true);
      mockUsers.resetPassword.mockResolvedValue(mockPublicUser.id);
      mockSessions.revokeEverySession.mockResolvedValue(undefined);

      const res = await authService.resetPassword({
        email: mockPublicUser.email,
        otp: '888999',
        newPassword: 'NewStrongPassword123!',
      });

      expect(mockOtpService.verifyResetPasswordOtp).toHaveBeenCalledWith(
        mockPublicUser.email,
        '888999',
      );
      expect(mockUsers.resetPassword).toHaveBeenCalledWith(
        mockPublicUser.email,
        'NewStrongPassword123!',
      );
      expect(mockSessions.revokeEverySession).toHaveBeenCalledWith(mockPublicUser.id);
      expect(res.message).toContain('successfully');
    });

    it('ném lỗi InvalidOtpError khi OTP reset không chính xác', async () => {
      mockOtpService.verifyResetPasswordOtp.mockRejectedValue(
        new InvalidOtpError('Mã không hợp lệ'),
      );

      await expect(
        authService.resetPassword({
          email: mockPublicUser.email,
          otp: '000000',
          newPassword: 'NewStrongPassword123!',
        }),
      ).rejects.toThrow(InvalidOtpError);

      expect(mockUsers.resetPassword).not.toHaveBeenCalled();
    });
  });

  describe('changePassword()', () => {
    it('đổi mật khẩu thành công và hủy các session khác', async () => {
      mockUsers.changePassword.mockResolvedValue(undefined);
      mockSessions.revokeEverySession.mockResolvedValue(undefined);

      const res = await authService.changePassword(mockPublicUser.id, {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      });

      expect(mockUsers.changePassword).toHaveBeenCalledWith(
        mockPublicUser.id,
        'OldPassword123!',
        'NewPassword123!',
      );
      expect(mockSessions.revokeEverySession).toHaveBeenCalledWith(mockPublicUser.id);
      expect(res.message).toBe('Password changed successfully.');
    });
  });
});
