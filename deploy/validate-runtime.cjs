// Container preflight: validate before touching the database. Never print secrets.
const env = process.env;
const errors = [];
const placeholderPattern = /CHANGE_ME|YOUR[_-]|GENERATE_|REAL_|REPLACE_|DATABASE_HOST|USER:PASSWORD|<|>|\*{3,}/i;
const mailDeliveryEnabled = env.MAIL_DELIVERY_ENABLED?.trim().toLowerCase();
if (env.NODE_ENV !== 'production') errors.push('NODE_ENV must be production');
for (const key of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'SELF_SCHEDULE_SECRET', 'EMAIL_OUTBOX_ENCRYPTION_KEY', 'WEB_ORIGIN', 'APP_WEB_URL']) {
  if (!env[key]?.trim() || placeholderPattern.test(env[key])) errors.push(`${key} must be configured`);
}
for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'SELF_SCHEDULE_SECRET']) {
  if ((env[key] ?? '').length < 32) errors.push(`${key} must contain at least 32 characters`);
}
if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) errors.push('JWT secrets must be different');
if (!/^[a-fA-F0-9]{64}$/.test(env.EMAIL_OUTBOX_ENCRYPTION_KEY ?? '')) errors.push('EMAIL_OUTBOX_ENCRYPTION_KEY must be 64 hexadecimal characters');
if (env.AUTH_COOKIE_SAME_SITE && !['lax', 'strict', 'none'].includes(env.AUTH_COOKIE_SAME_SITE.trim().toLowerCase())) {
  errors.push('AUTH_COOKIE_SAME_SITE must be lax, strict, or none');
}
if (env.AUTH_COOKIE_SAME_SITE?.trim().toLowerCase() === 'none' && env.NODE_ENV !== 'production') {
  errors.push('AUTH_COOKIE_SAME_SITE=none requires NODE_ENV=production');
}
try {
  const databaseUrl = new URL(env.DATABASE_URL ?? '');
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) || !databaseUrl.hostname) throw new Error();
} catch {
  errors.push('DATABASE_URL must be a valid PostgreSQL connection URL');
}
for (const value of [env.APP_WEB_URL, ...(env.WEB_ORIGIN ?? '').split(',')]) {
  try {
    const url = new URL(value?.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.hostname.includes('*') || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error();
  } catch { errors.push('APP_WEB_URL and WEB_ORIGIN must use public HTTPS URLs with exact origins'); }
}
const port = Number(env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT must be between 1 and 65535');
if (env.RECRUITFLOW_API_PORT || env.VACANCY_CORE_ADAPTER === 'in-memory') errors.push('Remove development port and in-memory adapter overrides');
if (mailDeliveryEnabled && !['true', 'false', '1', '0'].includes(mailDeliveryEnabled)) errors.push('MAIL_DELIVERY_ENABLED must be true, false, 1, or 0');
const mailTransport = env.MAIL_TRANSPORT?.trim().toLowerCase();
if (mailTransport && !['smtp', 'console'].includes(mailTransport)) errors.push('MAIL_TRANSPORT must be smtp or console');
const deliveryEnabled = !['false', '0'].includes(mailDeliveryEnabled ?? 'true');
if (env.NODE_ENV === 'production' && deliveryEnabled && mailTransport !== 'smtp') errors.push('Production workers require MAIL_TRANSPORT=smtp when mail delivery is enabled');
if (mailTransport === 'smtp' && deliveryEnabled) {
  if (!env.SMTP_HOST?.trim() || placeholderPattern.test(env.SMTP_HOST)) errors.push('SMTP_HOST must be configured when MAIL_TRANSPORT=smtp');
  const smtpPort = Number(env.SMTP_PORT ?? 587);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) errors.push('SMTP_PORT must be between 1 and 65535');
  if (env.SMTP_SECURE && !['true', 'false', '1', '0'].includes(env.SMTP_SECURE.trim().toLowerCase())) errors.push('SMTP_SECURE must be true, false, 1, or 0');
  if (env.SMTP_USER?.trim() && (!env.SMTP_PASS?.trim() || placeholderPattern.test(env.SMTP_PASS))) errors.push('SMTP_PASS must be configured when SMTP_USER is set');
  if (!env.MAIL_FROM?.trim() || placeholderPattern.test(env.MAIL_FROM) || !/^\S+@\S+\.\S+$/.test(env.MAIL_FROM.trim())) errors.push('MAIL_FROM must be a valid configured email address');
}
if (env.REDIS_URL?.trim()) {
  try {
    const redisUrl = new URL(env.REDIS_URL.trim());
    if (!['redis:', 'rediss:'].includes(redisUrl.protocol) || !redisUrl.hostname) throw new Error();
  } catch {
    errors.push('REDIS_URL must be a valid redis:// or rediss:// URL');
  }
}
if (errors.length) {
  console.error(`Deployment configuration invalid:\n${errors.join('\n')}`);
  process.exit(1);
}
