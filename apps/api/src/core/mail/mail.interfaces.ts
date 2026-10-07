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
