import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const DEV_KEY = createHash('sha256').update('recruitflow-development-email-outbox').digest();

type JsonPayload = Record<string, unknown>;

export interface EncryptedPayload {
  encryptedData: string;
  iv: string;
  authTag: string;
}

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

  const { encryptedData, iv, authTag } = encryptSecureSecret(token);
  const { token: _token, ...rest } = payload;

  return {
    ...rest,
    encryptedToken: encryptedData,
    tokenIv: iv,
    tokenAuthTag: authTag,
  };
}

export function encryptSecureSecret(text: string): EncryptedPayload {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted.toString('base64url'),
    iv: iv.toString('base64url'),
    authTag: authTag.toString('base64url'),
  };
}

export function decryptSecureSecret(encrypted: EncryptedPayload): string {
  const iv = Buffer.from(encrypted.iv, 'base64url');
  const authTag = Buffer.from(encrypted.authTag, 'base64url');
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted.encryptedData, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
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
