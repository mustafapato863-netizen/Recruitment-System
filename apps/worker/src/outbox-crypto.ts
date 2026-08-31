import { createDecipheriv, createHash } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const DEV_KEY = createHash('sha256').update('recruitflow-development-email-outbox').digest();

type JsonPayload = Record<string, unknown>;

/** Validate the key at worker startup and fail closed in production. */
export function assertOutboxEncryptionKey(): void {
  encryptionKey();
}

/** Decrypt an auth token only in the worker process immediately before render/send. */
export function unprotectOutboxPayload(payload: JsonPayload): JsonPayload {
  if (typeof payload.token === 'string' && payload.token.length > 0) {
    throw new Error('Outbox auth email payload contains an unencrypted token');
  }

  const encryptedToken = payload.encryptedToken;
  const tokenIv = payload.tokenIv;
  const tokenAuthTag = payload.tokenAuthTag;
  if (typeof encryptedToken !== 'string' || typeof tokenIv !== 'string' || typeof tokenAuthTag !== 'string') {
    return payload;
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(tokenIv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tokenAuthTag, 'base64url'));
  const token = Buffer.concat([
    decipher.update(Buffer.from(encryptedToken, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  const {
    encryptedToken: _encryptedToken,
    tokenIv: _tokenIv,
    tokenAuthTag: _tokenAuthTag,
    ...rest
  } = payload;
  return { ...rest, token };
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
