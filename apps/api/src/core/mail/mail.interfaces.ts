export interface MailAttachment {
  filename: string;
  path?: string | undefined;
  content?: string | Buffer | undefined;
  cid?: string | undefined;
  contentType?: string | undefined;
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string | undefined;
  from?: string | undefined;
  attachments?: MailAttachment[] | undefined;
}

export interface OtpEmailPayload {
  toEmail: string;
  recipientName: string;
  otp: string;
  ttlMinutes?: number;
}

export interface InvitationEmailPayload {
  toEmail: string;
  recipientName: string;
  /** Full name of the admin who created the account. */
  inviterName: string;
  /** Falls back to the product name for a platform-scope account. */
  tenantName: string;
  /** Absolute link to the web page that accepts the invitation. */
  acceptUrl: string;
  ttlHours: number;
}
