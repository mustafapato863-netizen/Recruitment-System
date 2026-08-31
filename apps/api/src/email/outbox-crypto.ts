import { createCipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const DEV_KEY = createHash('sha256').update('recruitflow-development-email-outbox').digest();

type JsonPayload = Record<string, unknown>;

/** Validate the key at API startup and fail closed in production. */
export function assertOutboxEncryptionKey(): void {
  encryptionKey();
}

/** Protect the one-time auth token before the payload is written to Postgres. */
export function protectOutboxPayload(payload: JsonPayload): JsonPayload {
  if (!Object.prototype.hasOwnProperty.call(payload, 'token')) return payload;
  const token = payload.token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('Outbox auth email payload token must be a non-empty string');
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const { token: _token, ...rest } = payload;

  return {
    ...rest,
    encryptedToken: encrypted.toString('base64url'),
    tokenIv: iv.toString('base64url'),
    tokenAuthTag: authTag.toString('base64url'),
  };
}

function encryptionKey(): Buffer {
  const configured = process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('EMAIL_OUTBOX_ENCRYPTION_KEY must be configured in production');
    }
    return DEV_KEY;
  }

  if (/^[0-9a-fA-F]{64}$/.test(configured)) return Buffer.from(configured, 'hex');
  const decoded = Buffer.from(configured, 'base64');
  if (decoded.length === 32) return decoded;
  throw new Error('EMAIL_OUTBOX_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex or base64 characters');
}
