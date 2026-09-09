import { describe, expect, it } from 'vitest';
import { createTransportFromEnv } from '../transport';

describe('mail delivery configuration', () => {
  it('returns a disabled transport when delivery is frozen', () => {
    const transport = createTransportFromEnv({
      NODE_ENV: 'production',
      MAIL_DELIVERY_ENABLED: 'false',
      MAIL_TRANSPORT: 'console',
      APP_WEB_URL: 'https://recruitflow.example.org',
    });

    expect(transport.name).toBe('disabled');
  });

  it('creates SMTP transport when delivery is enabled', () => {
    const transport = createTransportFromEnv({
      NODE_ENV: 'production',
      MAIL_DELIVERY_ENABLED: 'true',
      MAIL_TRANSPORT: 'smtp',
      SMTP_HOST: 'smtp.example.org',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      MAIL_FROM: 'no-reply@example.org',
      APP_WEB_URL: 'https://recruitflow.example.org',
    });

    expect(transport.name).toBe('smtp');
  });
});
