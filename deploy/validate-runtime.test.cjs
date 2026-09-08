const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const valid = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://test:test@db/test',
  JWT_ACCESS_SECRET: 'a'.repeat(64), JWT_REFRESH_SECRET: 'b'.repeat(64),
  SELF_SCHEDULE_SECRET: 'c'.repeat(64), EMAIL_OUTBOX_ENCRYPTION_KEY: 'd'.repeat(64),
  WEB_ORIGIN: 'https://recruitflow.example.org', APP_WEB_URL: 'https://recruitflow.example.org',
  PORT: '3000', VACANCY_CORE_ADAPTER: 'prisma', MAIL_TRANSPORT: 'smtp',
  SMTP_HOST: 'smtp.example.org', SMTP_PORT: '587', SMTP_SECURE: 'false', MAIL_FROM: 'no-reply@example.org',
};
function run(overrides) {
  return spawnSync(process.execPath, [path.join(__dirname, 'validate-runtime.cjs')], {
    env: { ...valid, ...overrides }, encoding: 'utf8',
  });
}
test('accepts explicit production settings', () => assert.equal(run({}).status, 0));
test('accepts cross-origin cookie mode for a Vercel frontend', () => assert.equal(run({ AUTH_COOKIE_SAME_SITE: 'none' }).status, 0));
for (const [name, override] of Object.entries({
  missingSecret: { JWT_ACCESS_SECRET: '' },
  placeholder: { DATABASE_URL: 'postgresql://CHANGE_ME@db/test' },
  localOrigin: { WEB_ORIGIN: 'http://localhost:5173' },
  badPort: { PORT: 'NaN' },
  localOverride: { RECRUITFLOW_API_PORT: '5173' },
  fakeStorage: { VACANCY_CORE_ADAPTER: 'in-memory' },
  invalidCookieMode: { AUTH_COOKIE_SAME_SITE: 'cross-site' },
  wildcardOrigin: { WEB_ORIGIN: 'https://*.vercel.app' },
  placeholderJwt: { JWT_ACCESS_SECRET: 'GENERATE_SECRET' },
  maskedDatabasePassword: { DATABASE_URL: 'postgresql://postgres:*****@db/test' },
  exampleDatabaseUrl: { DATABASE_URL: 'postgresql://USER:PASSWORD@DATABASE_HOST:5432/recruitflow' },
  placeholderSmtpHost: { SMTP_HOST: 'REAL_SMTP_HOST' },
  invalidMailTransport: { MAIL_TRANSPORT: 'mailhog' },
})) test(`rejects ${name}`, () => assert.equal(run(override).status, 1));
test('does not leak invalid secrets into logs', () => {
  const result = run({ JWT_ACCESS_SECRET: 'do-not-log-this' });
  assert.equal(result.stderr.includes('do-not-log-this'), false);
});
