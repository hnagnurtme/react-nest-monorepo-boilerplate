import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '@/config/index.js';
import { MailService } from '@/core/mail/mail.service.js';

interface ConfigOverrides {
  mailBrand?: AppConfig['mailBrand'];
}

function makeConfig(overrides: ConfigOverrides = {}): AppConfig {
  return {
    appName: 'Starter App',
    smtp: {
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      // Blank credentials keep the transporter undefined, so nothing is sent.
      user: '',
      pass: '',
      from: 'Starter App <no-reply@example.com>',
    },
    mailBrand: {
      logoUrl: undefined,
      backgroundUrl: undefined,
      brandColor: '#2563eb',
      supportEmail: undefined,
    },
    ...overrides,
  } as unknown as AppConfig;
}

/** Captures what would have been sent, without touching nodemailer. */
function capture(service: MailService): string[] {
  const htmls: string[] = [];
  vi.spyOn(service, 'sendMail').mockImplementation((options) => {
    htmls.push(options.html);
    return Promise.resolve(true);
  });
  return htmls;
}

describe('MailService', () => {
  let service: MailService;
  let htmls: string[];

  beforeEach(() => {
    service = new MailService(makeConfig());
    htmls = capture(service);
  });

  it('escapes interpolated user input instead of trusting it as markup', async () => {
    await service.sendInvitationMail({
      toEmail: 'victim@example.com',
      recipientName: '<script>alert(1)</script>',
      inviterName: 'Admin',
      tenantName: 'Acme',
      acceptUrl: 'https://app.example.com/accept-invitation?token=abc',
      ttlHours: 72,
    });

    const [html] = htmls;
    expect(html).toBeDefined();
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders one box per digit of the reset code and leaves no placeholder behind', async () => {
    await service.sendResetPasswordMail({
      toEmail: 'user@example.com',
      recipientName: 'Jane',
      otp: '104795',
      ttlMinutes: 5,
    });

    const [html] = htmls;
    expect(html?.match(/<td style="padding: 0 6px 0 0">/g)).toHaveLength(6);
    expect(html).not.toContain('{{');
  });

  it('falls back to the product name when no logo URL is configured', async () => {
    await service.sendResetPasswordMail({
      toEmail: 'user@example.com',
      recipientName: 'Jane',
      otp: '123456',
    });

    const [html] = htmls;
    expect(html).not.toContain('<img');
    expect(html).toContain('Starter App');
  });

  it('embeds the configured logo, background and support address', async () => {
    const branded = new MailService(
      makeConfig({
        mailBrand: {
          logoUrl: 'https://cdn.example.com/logo.png',
          backgroundUrl: 'https://cdn.example.com/bg.png',
          brandColor: '#ff0000',
          supportEmail: 'help@example.com',
        },
      }),
    );
    const brandedHtmls = capture(branded);

    await branded.sendInvitationMail({
      toEmail: 'user@example.com',
      recipientName: 'Jane',
      inviterName: 'Admin',
      tenantName: 'Acme',
      acceptUrl: 'https://app.example.com/accept-invitation?token=abc',
      ttlHours: 24,
    });

    const [html] = brandedHtmls;
    expect(html).toContain('https://cdn.example.com/logo.png');
    expect(html).toContain('https://cdn.example.com/bg.png');
    expect(html).toContain('#ff0000');
    expect(html).toContain('mailto:help@example.com');
  });
});
