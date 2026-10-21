import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

import { AppConfig } from '@/config/index.js';

import type {
  InvitationEmailPayload,
  OtpEmailPayload,
  SendMailOptions,
  TenantInvitationEmailPayload,
} from './mail.interfaces.js';

const DEFAULT_OTP_TTL_MINUTES = 5;

/**
 * Transport limits.
 *
 * Without a pool every message opened its own SMTP connection, and a burst —
 * a batch of invitations, or one retried send — is what gets a relay to answer
 * `552 Your IP Address is blocked from further use`. Pooled and rate-limited,
 * the same batch travels down two connections at a few messages per second.
 *
 * The timeouts matter just as much: a send issued inside a request's
 * transaction would otherwise hold it — and its row locks — open for
 * nodemailer's minutes-long defaults whenever a relay keeps the socket alive.
 */
const SMTP_POOL_MAX_CONNECTIONS = 2;
const SMTP_POOL_MAX_MESSAGES = 100;
/** At most {@link SMTP_RATE_LIMIT} messages per {@link SMTP_RATE_DELTA_MS}. */
const SMTP_RATE_DELTA_MS = 1000;
const SMTP_RATE_LIMIT = 5;
const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
const SMTP_GREETING_TIMEOUT_MS = 10_000;
const SMTP_SOCKET_TIMEOUT_MS = 20_000;

/** Placeholders whose value is already HTML and must not be escaped again. */
const RAW_PLACEHOLDERS = new Set(['content', 'logoBlock', 'supportBlock', 'otpCells']);

/** `{{name}}`, matched in one pass so a substituted value is never rescanned. */
const PLACEHOLDER = /{{(\w+)}}/g;

/**
 * Values interpolated into a template come from user input (a full name, a
 * tenant name). Without this, a display name of `<script>` would travel into
 * every recipient's inbox.
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

@Injectable()
export class MailService implements OnModuleDestroy {
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
      pool: true,
      maxConnections: SMTP_POOL_MAX_CONNECTIONS,
      maxMessages: SMTP_POOL_MAX_MESSAGES,
      rateDelta: SMTP_RATE_DELTA_MS,
      rateLimit: SMTP_RATE_LIMIT,
      connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
      socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    });
  }

  /** A pooled transport keeps sockets open; shutdown has to close them. */
  onModuleDestroy(): void {
    this.transporter?.close();
    this.transporter = undefined;
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
    const { toEmail, recipientName, otp, ttlMinutes = DEFAULT_OTP_TTL_MINUTES } = payload;

    // The code is logged only when no SMTP transport is configured (local
    // development); in any environment that really sends mail it is a secret.
    if (!this.transporter) {
      this.logger.debug(
        `[Mail DEV MOCK] Reset-password OTP for [${toEmail}]: ${otp} (expires in ${String(ttlMinutes)} min)`,
      );
    }

    const subject = `${otp} is your ${this.config.appName} verification code`;

    const html = this.renderWithLayout(
      'reset-password.html',
      {
        recipientName,
        otp,
        ttlMinutes: ttlMinutes.toString(),
        appName: this.config.appName,
        otpCells: renderOtpCells(otp),
      },
      { subject, preheader: `Your code expires in ${String(ttlMinutes)} minutes.` },
    );

    await this.sendMail({
      to: toEmail,
      subject,
      html,
      text: `Your ${this.config.appName} verification code is ${otp}. It expires in ${String(ttlMinutes)} minutes.`,
    });
  }

  /**
   * Send the invitation an admin triggers by creating an account. The link
   * carries a single-use token; the mail itself is the only place it appears,
   * so it is never logged.
   */
  async sendInvitationMail(payload: InvitationEmailPayload): Promise<void> {
    const { toEmail, recipientName, inviterName, tenantName, acceptUrl, ttlHours } = payload;
    const subject = `${inviterName} invited you to ${tenantName}`;

    const html = this.renderWithLayout(
      'invitation.html',
      {
        recipientName,
        inviterName,
        tenantName,
        acceptUrl,
        ttlHours: ttlHours.toString(),
        appName: this.config.appName,
        brandColor: this.config.mailBrand.brandColor,
      },
      { subject, preheader: `Set your password to activate your ${tenantName} account.` },
    );

    await this.sendMail({
      to: toEmail,
      subject,
      html,
      text: `${inviterName} invited you to ${tenantName}. Set your password: ${acceptUrl} (expires in ${String(ttlHours)} hours).`,
    });
  }

  async sendTenantInvitationMail(payload: TenantInvitationEmailPayload): Promise<void> {
    const { toEmail, recipientName, inviterName, tenantName, acceptUrl, ttlHours } = payload;
    const subject = `${inviterName} invited you to join ${tenantName}`;

    const html = this.renderWithLayout(
      'tenant-invitation.html',
      {
        recipientName,
        inviterName,
        tenantName,
        acceptUrl,
        ttlHours: ttlHours.toString(),
        appName: this.config.appName,
        brandColor: this.config.mailBrand.brandColor,
      },
      { subject, preheader: `Accept to start working in ${tenantName}.` },
    );

    await this.sendMail({
      to: toEmail,
      subject,
      html,
      text: `${inviterName} invited you to join ${tenantName} with your existing ${this.config.appName} account. Accept: ${acceptUrl} (expires in ${String(ttlHours)} hours).`,
    });
  }

  /** Renders a content template, then drops the result into the shared frame. */
  private renderWithLayout(
    fileName: string,
    variables: Record<string, string>,
    meta: { subject: string; preheader: string },
  ): string {
    const brand = this.config.mailBrand;
    const content = this.renderTemplateFromFile(fileName, variables);

    return this.renderTemplateFromFile('_layout.html', {
      content,
      subject: meta.subject,
      preheader: meta.preheader,
      appName: this.config.appName,
      year: new Date().getFullYear().toString(),
      brandColor: brand.brandColor,
      backgroundUrl: brand.backgroundUrl ?? '',
      logoBlock: renderLogoBlock(brand.logoUrl, this.config.appName),
      supportBlock: renderSupportBlock(brand.supportEmail),
    });
  }

  private renderTemplateFromFile(fileName: string, variables: Record<string, string>): string {
    let template = this.templateCache.get(fileName);

    if (template === undefined) {
      const templatePath = resolve(this.templatesDir, fileName);
      if (existsSync(templatePath)) {
        template = readFileSync(templatePath, 'utf8');
        this.templateCache.set(fileName, template);
      } else {
        this.logger.error(`Not found template file at [${templatePath}]`);
        template = '<p>Hello {{recipientName}}, your code is: <strong>{{otp}}</strong></p>';
      }
    }

    /*
      One pass, so a value cannot be read as a placeholder.
      `escapeHtml` leaves braces alone, and substituting key by key meant a
      display name of `{{otp}}` was replaced by the real code on the next
      iteration — the layout pass was worse, since `content` goes in first and
      `logoBlock` / `supportBlock` are injected unescaped. A replacer function
      never re-scans what it just wrote.
    */
    return template.replaceAll(PLACEHOLDER, (match: string, key: string) => {
      const value = variables[key];
      if (value === undefined) return match;

      return RAW_PLACEHOLDERS.has(key) ? value : escapeHtml(value);
    });
  }
}

/** The Lark-style digit boxes: one bordered cell per character of the code. */
function renderOtpCells(otp: string): string {
  // Array.from with an index callback: the code is ASCII digits, but the spread
  // form trips the no-misused-spread rule and would split surrogate pairs.
  return Array.from(otp, (digit) => digit)
    .map(
      (digit) =>
        `<td style="padding: 0 6px 0 0"><div style="width: 44px; height: 52px; line-height: 52px; text-align: center; background-color: #f2f3f5; border: 1px solid #e4e6eb; border-radius: 8px; font-size: 24px; font-weight: 700; color: #1f2329">${escapeHtml(digit)}</div></td>`,
    )
    .join('');
}

function renderLogoBlock(logoUrl: string | undefined, appName: string): string {
  const name = escapeHtml(appName);

  // No logo configured, or the recipient's client blocked it: the alt text is
  // the fallback, so it carries the product name rather than "image".
  if (logoUrl === undefined) {
    return `<span style="font-size: 20px; font-weight: 700; color: #ffffff">${name}</span>`;
  }

  return `<img src="${escapeHtml(logoUrl)}" alt="${name}" height="32" style="height: 32px; display: block; border: 0" />`;
}

function renderSupportBlock(supportEmail: string | undefined): string {
  if (supportEmail === undefined) return '';

  const address = escapeHtml(supportEmail);
  return `<div style="margin-bottom: 4px">Need help? <a href="mailto:${address}" style="color: #646a73">${address}</a></div>`;
}
