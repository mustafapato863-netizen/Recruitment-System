export type OutboxTemplate = 'password_reset' | 'email_verification' | 'invitation' | 'notification';

interface TemplatePayload {
  token?: string;
  displayName?: string;
  expiresAt?: string;
  title?: string;
  message?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const BUTTON_STYLE =
  'display:inline-block;background:#1a56db;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;';

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f6f8;font-family:Segoe UI,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;padding:32px;border:1px solid #e5e7eb;">
    <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">${title}</h1>
    ${bodyHtml}
    <p style="margin-top:28px;font-size:12px;color:#6b7280;">If you did not expect this email, you can safely ignore it.</p>
  </div>
</body></html>`;
}

function linkButton(url: string, label: string): string {
  const safeUrl = escapeHtml(url);
  return `<p style="margin:20px 0;"><a href="${safeUrl}" style="${BUTTON_STYLE}">${label}</a></p>
  <p style="font-size:13px;color:#374151;">Or paste this link into your browser:<br><span style="color:#1a56db;word-break:break-all;">${safeUrl}</span></p>`;
}

/** Build the final email for an outbox row. Pure function — no I/O. */
export function renderTemplate(
  template: string,
  payload: TemplatePayload,
  webUrl: string,
): RenderedEmail {
  const name = escapeHtml(payload.displayName ?? 'there');
  const baseUrl = webUrl.replace(/\/+$/, '');
  const expiry = payload.expiresAt
    ? new Date(payload.expiresAt).toUTCString()
    : 'shortly';

  switch (template as OutboxTemplate) {
    case 'password_reset': {
      const url = `${baseUrl}/reset-password?token=${encodeURIComponent(requiredToken(payload))}`;
      return {
        subject: 'Reset your RecruitFlow password',
        html: layout(
          'Password reset request',
          `<p style="font-size:14px;color:#374151;">Hi ${name}, we received a request to reset your password.</p>` +
            linkButton(url, 'Choose a new password') +
            `<p style="font-size:13px;color:#6b7280;">This link expires at ${expiry}.</p>`,
        ),
        text: `Hi ${name},\n\nWe received a request to reset your RecruitFlow password. Open the link below to choose a new one (expires at ${expiry}):\n\n${url}\n\nIf you did not request this, ignore this email.`,
      };
    }
    case 'email_verification': {
      const url = `${baseUrl}/verify-email?token=${encodeURIComponent(requiredToken(payload))}`;
      return {
        subject: 'Verify your email address',
        html: layout(
          'Confirm your email',
          `<p style="font-size:14px;color:#374151;">Hi ${name}, please confirm your email address to finish setting up your RecruitFlow account.</p>` +
            linkButton(url, 'Verify my email') +
            `<p style="font-size:13px;color:#6b7280;">This link expires at ${expiry}.</p>`,
        ),
        text: `Hi ${name},\n\nPlease confirm your email address to finish setting up your RecruitFlow account (link expires at ${expiry}):\n\n${url}`,
      };
    }
    case 'invitation': {
      const url = `${baseUrl}/accept-invitation?token=${encodeURIComponent(requiredToken(payload))}`;
      return {
        subject: "You're invited to join RecruitFlow",
        html: layout(
          'Welcome to RecruitFlow',
          `<p style="font-size:14px;color:#374151;">Hi ${name}, you have been invited to join your team on RecruitFlow. Accept your invitation to create your account.</p>` +
            linkButton(url, 'Accept invitation') +
            `<p style="font-size:13px;color:#6b7280;">This invitation expires at ${expiry}.</p>`,
        ),
        text: `Hi ${name},\n\nYou have been invited to join your team on RecruitFlow. Accept your invitation to create your account (expires at ${expiry}):\n\n${url}`,
      };
    }
    case 'notification': {
      const title = payload.title?.trim() || 'RecruitFlow notification';
      const message = payload.message?.trim() || 'You have a new notification in RecruitFlow.';
      return {
        subject: title,
        html: layout(
          escapeHtml(title),
          `<p style="font-size:14px;color:#374151;white-space:pre-line;">${escapeHtml(message)}</p>`,
        ),
        text: `${title}\n\n${message}`,
      };
    }
    default:
      throw new Error(`Unknown outbox template: ${template}`);
  }
}

function requiredToken(payload: TemplatePayload): string {
  const token = payload.token?.trim();
  if (!token) throw new Error('Outbox auth email payload is missing its token');
  return token;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
