/**
 * Strong password policy (user management slice).
 *
 * Rules: at least 10 characters, at most 128, at least one uppercase letter,
 * one lowercase letter, one digit, and one special (non-alphanumeric)
 * character. The password must not contain the local part of the user's email
 * address (case-insensitive, only when the local part is at least 3 chars).
 *
 * Framework-free on purpose: the API services and the zod schemas both
 * consume `evaluateStrongPassword`, and the generator is usable in Node and
 * in the browser (WebCrypto when available).
 */

export const STRONG_PASSWORD_MIN_LENGTH = 10;
export const STRONG_PASSWORD_MAX_LENGTH = 128;

export type PasswordCheckKey =
  | 'minLength'
  | 'uppercase'
  | 'lowercase'
  | 'digit'
  | 'special'
  | 'noEmailLocalPart';

export interface StrongPasswordEvaluation {
  valid: boolean;
  /** Human-readable messages for every failed rule, in rule order. */
  errors: string[];
  checks: Record<PasswordCheckKey, boolean>;
}

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
/** No space, quotes, or backslash, so generated passwords survive JSON/SQL round-trips. */
const SPECIAL = '!@#$%^&*()-_=+[]{};:,.?';
const ALL_CHARS = UPPERCASE + LOWERCASE + DIGITS + SPECIAL;

export function emailLocalPart(email: string | undefined | null): string {
  if (!email) return '';
  return email.split('@')[0]?.trim() ?? '';
}

export function evaluateStrongPassword(
  password: string,
  email?: string | null,
): StrongPasswordEvaluation {
  const value = typeof password === 'string' ? password : '';
  const errors: string[] = [];
  const checks: Record<PasswordCheckKey, boolean> = {
    minLength: value.length >= STRONG_PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    digit: /[0-9]/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
    noEmailLocalPart: true,
  };

  if (!checks.minLength) {
    errors.push(
      `Password must be at least ${STRONG_PASSWORD_MIN_LENGTH} characters long.`,
    );
  }
  if (value.length > STRONG_PASSWORD_MAX_LENGTH) {
    errors.push(
      `Password must be at most ${STRONG_PASSWORD_MAX_LENGTH} characters long.`,
    );
  }
  if (!checks.uppercase) {
    errors.push('Password must contain at least one uppercase letter.');
  }
  if (!checks.lowercase) {
    errors.push('Password must contain at least one lowercase letter.');
  }
  if (!checks.digit) {
    errors.push('Password must contain at least one digit.');
  }
  if (!checks.special) {
    errors.push('Password must contain at least one special character.');
  }
  const localPart = emailLocalPart(email);
  if (localPart.length >= 3 && value.toLowerCase().includes(localPart.toLowerCase())) {
    checks.noEmailLocalPart = false;
    errors.push('Password must not contain your email address.');
  }

  return {
    valid: errors.length === 0,
    errors,
    checks,
  };
}

/** CSPRNG-backed random integer in [0, max); rejection sampling avoids modulo bias. */
function secureRandomInt(max: number): number {
  const cryptoRef = (
    globalThis as unknown as {
      crypto?: { getRandomValues: (array: Uint32Array) => Uint32Array };
    }
  ).crypto;
  if (!cryptoRef || typeof cryptoRef.getRandomValues !== 'function') {
    throw new Error('A secure random number generator is not available in this environment.');
  }
  const range = 0x100000000; // 2^32
  const limit = range - (range % max);
  const buffer = new Uint32Array(1);
  for (;;) {
    cryptoRef.getRandomValues(buffer);
    const value = buffer[0];
    if (value < limit) return value % max;
  }
}

/**
 * Generate a password that always satisfies the strong policy: at least one
 * character of each required class, shuffled so class positions are random.
 * Length defaults to 14 and must stay within the policy bounds.
 */
export function generateStrongPassword(length = 14): string {
  if (
    !Number.isInteger(length) ||
    length < STRONG_PASSWORD_MIN_LENGTH ||
    length > STRONG_PASSWORD_MAX_LENGTH
  ) {
    throw new RangeError(
      `Password length must be between ${STRONG_PASSWORD_MIN_LENGTH} and ${STRONG_PASSWORD_MAX_LENGTH}.`,
    );
  }
  const classes = [UPPERCASE, LOWERCASE, DIGITS, SPECIAL];
  const chars: string[] = classes.map(
    (charsForClass) => charsForClass[secureRandomInt(charsForClass.length)],
  );
  while (chars.length < length) {
    chars.push(ALL_CHARS[secureRandomInt(ALL_CHARS.length)]);
  }
  // Fisher-Yates shuffle so the guaranteed class characters are not pinned
  // to the first four positions.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
