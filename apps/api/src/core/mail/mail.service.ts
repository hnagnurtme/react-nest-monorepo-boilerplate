import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

import { AppConfig } from '@/config/index.js';

import type { OtpEmailPayload, SendMailOptions } from './mail.interfaces.js';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | undefined;

  private readonly templateCache = new Map<string, string>();

  private readonly templatesDir = resolve(import.meta.dirname, 'templates');

  constructor(@Inject(AppConfig) private readonly config: AppConfig) {
    this.initTransporter();
  }

  private initTransporter(): void {
    const { smtp } = this.config;

    if (!smtp.user || !smtp.pass) {
      this.logger.warn(
        'SMTP_USER or SMTP_PASS is not configured. The system will log the OTP code to the console in the development environment.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    });
  }

  /**
   * Send email general method
   */
  async sendMail(options: SendMailOptions): Promise<boolean> {
    const { smtp } = this.config;
    const fromAddress = options.from ?? smtp.from;
    const recipientStr = Array.isArray(options.to) ? options.to.join(', ') : options.to;

    if (!this.transporter) {
      this.logger.log(`[Mail DEV MOCK] Send to [${recipientStr}] | Title: "${options.subject}"`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });

      this.logger.log(`Email sent successfully to [${recipientStr}]`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to [${recipientStr}]: ${String(error)}`);
      return false;
    }
  }

  /** Alias for backward compatibility */
  async sendEmail(options: SendMailOptions): Promise<boolean> {
    return this.sendMail(options);
  }

  /**
   * Send reset password OTP email
   */
  async sendResetPasswordMail(payload: OtpEmailPayload): Promise<void> {
    const { toEmail, recipientName, otp, ttlMinutes = 5 } = payload;

    // The code is logged only when no SMTP transport is configured (local
    // development); in any environment that really sends mail it is a secret.
    if (!this.transporter) {
      this.logger.debug(
        `[Mail DEV MOCK] Reset-password OTP for [${toEmail}]: ${otp} (expires in ${String(ttlMinutes)} min)`,
      );
    }

    const renderedHtml = this.renderTemplateFromFile('reset-password.html', {
      recipientName,
      otp,
      ttlMinutes: ttlMinutes.toString(),
      year: new Date().getFullYear().toString(),
      appName: this.config.appName,
    });

    await this.sendMail({
      to: toEmail,
      subject: `[${this.config.appName}] Your password reset code`,
      html: renderedHtml,
    });
  }

  private renderTemplateFromFile(fileName: string, variables: Record<string, string>): string {
    let template = this.templateCache.get(fileName);

    if (!template) {
      const templatePath = resolve(this.templatesDir, fileName);
      if (existsSync(templatePath)) {
        template = readFileSync(templatePath, 'utf8');
        this.templateCache.set(fileName, template);
      } else {
        this.logger.error(`Not found template file at [${templatePath}]`);
        template = `<p>Hello {{recipientName}}, your code is: <strong>{{otp}}</strong></p>`;
      }
    }

    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replaceAll(`{{${key}}}`, value);
    }
    return rendered;
  }
}
