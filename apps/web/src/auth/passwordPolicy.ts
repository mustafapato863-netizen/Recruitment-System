/**
 * Strong password policy — UI adapter over the shared evaluator.
 *
 * The rules live in @recruitflow/validation (`evaluateStrongPassword` /
 * `generateStrongPassword`): min 10 chars, max 128, at least one upper-case,
 * one lower-case, one digit, one symbol, and no email local part (>= 3
 * chars). The backend enforces the identical set, so this module adapts the
 * shared result into the checklist/strength shape the UI needs instead of
 * re-implementing the rules. Do not add local rules here — change the
 * shared package and the parity tests together.
 */
import {
  STRONG_PASSWORD_MAX_LENGTH,
  STRONG_PASSWORD_MIN_LENGTH,
  evaluateStrongPassword as evaluateShared,
  generateStrongPassword as generateShared,
  type PasswordCheckKey,
} from '@recruitflow/validation';

export { STRONG_PASSWORD_MAX_LENGTH, STRONG_PASSWORD_MIN_LENGTH };

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordRule {
  id: string;
  label: string;
  passed: boolean;
}

export interface StrongPasswordEvaluation {
  rules: PasswordRule[];
  passedCount: number;
  totalCount: number;
  valid: boolean;
  strength: PasswordStrength;
  strengthLabel: string;
  /** Labels of the rules the password still fails, in checklist order. */
  unmetLabels: string[];
}

const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  weak: 'Weak',
  fair: 'Fair',
  good: 'Good',
  strong: 'Strong',
};

const RULE_LABELS: Record<PasswordCheckKey, string> = {
  minLength: `At least ${STRONG_PASSWORD_MIN_LENGTH} characters`,
  uppercase: 'At least one upper-case letter (A–Z)',
  lowercase: 'At least one lower-case letter (a–z)',
  digit: 'At least one number (0–9)',
  special: 'At least one symbol (for example ! @ # $)',
  noEmailLocalPart: 'Does not contain your email name',
};

export function evaluateStrongPassword(password: string, email?: string | null): StrongPasswordEvaluation {
  const value = password ?? '';
  const shared = evaluateShared(value, email);
  const localPart = (email ?? '').split('@')[0]?.trim() ?? '';
  const rules: PasswordRule[] = (Object.keys(RULE_LABELS) as PasswordCheckKey[])
    .filter((key) => key !== 'noEmailLocalPart' || localPart.length >= 3)
    .map((key) => ({ id: key === 'minLength' ? 'length' : key === 'noEmailLocalPart' ? 'email' : key, label: RULE_LABELS[key], passed: shared.checks[key] }));
  const maxLengthPassed = value.length <= STRONG_PASSWORD_MAX_LENGTH;
  rules.push({ id: 'maxLength', label: `At most ${STRONG_PASSWORD_MAX_LENGTH} characters`, passed: maxLengthPassed });
  const passedCount = rules.filter((rule) => rule.passed).length;
  const totalCount = rules.length;
  // `valid` comes from the shared evaluator (it also enforces max length).
  const valid = shared.valid;
  const ratio = totalCount === 0 ? 0 : passedCount / totalCount;
  const strength: PasswordStrength = valid ? 'strong' : ratio >= 0.8 ? 'good' : ratio >= 0.6 ? 'fair' : 'weak';
  return {
    rules,
    passedCount,
    totalCount,
    valid,
    strength,
    strengthLabel: STRENGTH_LABELS[strength],
    unmetLabels: rules.filter((rule) => !rule.passed).map((rule) => rule.label),
  };
}

/**
 * Generate a 16-character password that always passes evaluateStrongPassword.
 * Delegates to the shared generator (WebCrypto-backed; throws when no secure
 * RNG is available rather than falling back to Math.random).
 */
export function generateStrongPassword(length = 16): string {
  return generateShared(length);
}
