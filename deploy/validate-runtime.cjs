// Container preflight: validate before touching the database. Never print secrets.
const env = process.env;
const errors = [];
for (const key of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'SELF_SCHEDULE_SECRET', 'EMAIL_OUTBOX_ENCRYPTION_KEY', 'WEB_ORIGIN', 'APP_WEB_URL']) {
  if (!env[key]?.trim() || /CHANGE_ME|YOUR_|<|>/.test(env[key])) errors.push(`${key} must be configured`);
}
for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'SELF_SCHEDULE_SECRET']) {
  if ((env[key] ?? '').length < 32) errors.push(`${key} must contain at least 32 characters`);
}
if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) errors.push('JWT secrets must be different');
if (!/^[a-fA-F0-9]{64}$/.test(env.EMAIL_OUTBOX_ENCRYPTION_KEY ?? '')) errors.push('EMAIL_OUTBOX_ENCRYPTION_KEY must be 64 hexadecimal characters');
for (const value of [env.APP_WEB_URL, ...(env.WEB_ORIGIN ?? '').split(',')]) {
  try {
    const url = new URL(value?.trim());
    if (url.protocol !== 'https:' || url.username || url.password || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error();
  } catch { errors.push('APP_WEB_URL and WEB_ORIGIN must use public HTTPS URLs'); }
}
const port = Number(env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT must be between 1 and 65535');
if (env.RECRUITFLOW_API_PORT || env.VACANCY_CORE_ADAPTER === 'in-memory') errors.push('Remove development port and in-memory adapter overrides');
if (errors.length) {
  console.error(`Deployment configuration invalid:\n${errors.join('\n')}`);
  process.exit(1);
}
