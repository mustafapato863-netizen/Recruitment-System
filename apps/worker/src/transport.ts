import { renderTemplate } from './templates';
import type { Transporter } from 'nodemailer';

export interface SendEmailInput {
  id: string;
  to: string;
  subject: string;
  template: string;
  payload: Record<string, unknown>;
}

export interface EmailTransport {
  readonly name: string;
  send(input: SendEmailInput): Promise<void>;
}

/** Dev/default transport — renders the email and writes it to stdout so
 *  flows can be verified end-to-end without an SMTP server. */
export class ConsoleTransport implements EmailTransport {
  readonly name = 'console';

  constructor(private readonly baseUrl = webUrl()) {}

  async send(input: SendEmailInput): Promise<void> {
    const rendered = renderTemplate(input.template, input.payload, this.baseUrl);
    const line = [
      '=== EMAIL (console transport) ===',
      `Message-ID: ${input.id}`,
      `To: ${input.to}`,
      `Subject: ${input.subject || rendered.subject}`,
      `--- text ---`,
      rendered.text,
      '================================',
    ].join('\n');
    console.log(line);
  }
}

/** SMTP transport used when MAIL_TRANSPORT=smtp and SMTP_HOST is set. */
export class SmtpTransport implements EmailTransport {
  readonly name = 'smtp';
  private transporter: Transporter | null = null;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly secure: boolean,
    private readonly user: string | undefined,
    private readonly pass: string | undefined,
    private readonly from: string,
    private readonly baseUrl: string,
  ) {}

  async send(input: SendEmailInput): Promise<void> {
    if (!this.transporter) {
      // Lazy require keeps startup cheap when SMTP is not used.
      const nodemailer = await import('nodemailer');
      this.transporter = nodemailer.createTransport({
        host: this.host,
        port: this.port,
        secure: this.secure,
        auth: this.user ? { user: this.user, pass: this.pass } : undefined,
      });
    }
    const rendered = renderTemplate(input.template, input.payload, this.baseUrl);
    await this.transporter.sendMail({
      messageId: `<${input.id}@recruitflow.local>`,
      from: this.from,
      to: input.to,
      subject: input.subject || rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }
}

export function createTransportFromEnv(env: NodeJS.ProcessEnv): EmailTransport {
  const kind = (env.MAIL_TRANSPORT ?? 'console').toLowerCase();
  const baseUrl = normalizeWebUrl(env.APP_WEB_URL ?? 'http://localhost:5173');
  if (kind !== 'console' && kind !== 'smtp') {
    throw new Error(`Unsupported MAIL_TRANSPORT: ${kind}`);
  }
  if (env.NODE_ENV === 'production' && kind !== 'smtp') {
    throw new Error('Production workers require MAIL_TRANSPORT=smtp');
  }
  if (kind === 'smtp') {
    const host = env.SMTP_HOST;
    if (!host) throw new Error('MAIL_TRANSPORT=smtp requires SMTP_HOST to be set');
    const port = Number(env.SMTP_PORT ?? 587);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('SMTP_PORT must be an integer between 1 and 65535');
    }
    if (env.SMTP_USER && !env.SMTP_PASS) {
      throw new Error('SMTP_PASS is required when SMTP_USER is set');
    }
    const from = env.MAIL_FROM ?? 'no-reply@recruitflow.local';
    if (!/^\S+@\S+\.\S+$/.test(from)) {
      throw new Error('MAIL_FROM must be a valid email address');
    }
    return new SmtpTransport(
      host,
      port,
      env.SMTP_SECURE === 'true' || env.SMTP_SECURE === '1',
      env.SMTP_USER,
      env.SMTP_PASS,
      from,
      baseUrl,
    );
  }
  return new ConsoleTransport(baseUrl);
}

function webUrl(): string {
  return process.env.APP_WEB_URL ?? 'http://localhost:5173';
}

function normalizeWebUrl(value: string): string {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('APP_WEB_URL must use http or https');
  }
  return value.replace(/\/+$/, '');
}
