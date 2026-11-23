import { describe, expect, it } from 'vitest';
import {
  evaluateStrongPassword,
  generateStrongPassword,
  STRONG_PASSWORD_MAX_LENGTH,
  STRONG_PASSWORD_MIN_LENGTH,
} from '../password-policy';
import { acceptInvitationSchema, changePasswordSchema, createUserSchema, strongPasswordSchema } from '../index';

const STRONG = 'Str0ng!Pass';

describe('evaluateStrongPassword', () => {
  it('accepts a password meeting every rule', () => {
    const result = evaluateStrongPassword(STRONG, 'jane@example.com');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.checks).toEqual({
      minLength: true,
      uppercase: true,
      lowercase: true,
      digit: true,
      special: true,
      noEmailLocalPart: true,
    });
  });

  it('rejects 9 characters but accepts 10', () => {
    expect(evaluateStrongPassword('Ab1!defgh').valid).toBe(false);
    expect(evaluateStrongPassword('Ab1!defgh').checks.minLength).toBe(false);
    expect(evaluateStrongPassword('Ab1!defghi').valid).toBe(true);
    expect(evaluateStrongPassword('Ab1!defghi').errors).toEqual([]);
  });

  it('rejects 129 characters but accepts 128', () => {
    const atMax = `A1!${'a'.repeat(STRONG_PASSWORD_MAX_LENGTH - 3)}`;
    expect(atMax.length).toBe(STRONG_PASSWORD_MAX_LENGTH);
    expect(evaluateStrongPassword(atMax).valid).toBe(true);
    const overMax = `${atMax}a`;
    expect(overMax.length).toBe(STRONG_PASSWORD_MAX_LENGTH + 1);
    const result = evaluateStrongPassword(overMax);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at most 128 characters long.');
  });

  it('flags each missing character class', () => {
    expect(evaluateStrongPassword('str0ng!pass').checks.uppercase).toBe(false);
    expect(evaluateStrongPassword('STR0NG!PASS').checks.lowercase).toBe(false);
    expect(evaluateStrongPassword('Strong!Pass').checks.digit).toBe(false);
    expect(evaluateStrongPassword('Str0ngPass1').checks.special).toBe(false);
    for (const password of ['str0ng!pass', 'STR0NG!PASS', 'Strong!Pass', 'Str0ngPass1']) {
      expect(evaluateStrongPassword(password).valid).toBe(false);
    }
  });

  it('rejects a password containing the email local part (case-insensitive)', () => {
    const result = evaluateStrongPassword('JaneDoe1!x', 'janedoe@example.com');
    expect(result.valid).toBe(false);
    expect(result.checks.noEmailLocalPart).toBe(false);
    expect(result.errors).toContain('Password must not contain your email address.');
    // Same password is fine for a different email.
    expect(evaluateStrongPassword('JaneDoe1!x', 'other@example.com').valid).toBe(true);
  });

  it('ignores an email local part shorter than 3 characters', () => {
    expect(evaluateStrongPassword('Ab1!defghi', 'ab@example.com').valid).toBe(true);
    // No email at all: the local-part rule passes.
    expect(evaluateStrongPassword(STRONG).valid).toBe(true);
  });

  it('reports every failed rule at once', () => {
    const result = evaluateStrongPassword('short');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(4); // length, uppercase, digit, special
  });
});

describe('generateStrongPassword', () => {
  it('generates a valid password of the default length', () => {
    const password = generateStrongPassword();
    expect(password.length).toBe(14);
    expect(evaluateStrongPassword(password).valid).toBe(true);
  });

  it('generates valid passwords of a requested length with all classes', () => {
    for (const length of [10, 20, 128]) {
      const password = generateStrongPassword(length);
      expect(password.length).toBe(length);
      const result = evaluateStrongPassword(password);
      expect(result.valid).toBe(true);
      expect(result.checks).toEqual({
        minLength: true,
        uppercase: true,
        lowercase: true,
        digit: true,
        special: true,
        noEmailLocalPart: true,
      });
    }
  });

  it('rejects lengths outside the policy bounds', () => {
    expect(() => generateStrongPassword(9)).toThrow(RangeError);
    expect(() => generateStrongPassword(129)).toThrow(RangeError);
    expect(() => generateStrongPassword(STRONG_PASSWORD_MIN_LENGTH - 1)).toThrow(RangeError);
    expect(() => generateStrongPassword(STRONG_PASSWORD_MAX_LENGTH + 1)).toThrow(RangeError);
  });

  it('does not pin the guaranteed class characters to fixed positions', () => {
    const passwords = Array.from({ length: 20 }, () => generateStrongPassword(10));
    const firstChars = new Set(passwords.map((p) => p[0]));
    expect(firstChars.size).toBeGreaterThan(1);
  });
});

describe('strongPasswordSchema (zod)', () => {
  it('accepts a strong password and rejects a weak one', () => {
    expect(strongPasswordSchema.safeParse(STRONG).success).toBe(true);
    expect(strongPasswordSchema.safeParse('weak').success).toBe(false);
    expect(strongPasswordSchema.safeParse('x'.repeat(129)).success).toBe(false);
  });

  it('rejects a password containing the email local part via createUserSchema', () => {
    const parsed = createUserSchema.safeParse({
      email: 'janedoe@example.com',
      displayName: 'Jane Doe',
      password: 'JaneDoe1!x',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.join('.') === 'password')).toBe(true);
    }
    expect(
      createUserSchema.safeParse({
        email: 'janedoe@example.com',
        displayName: 'Jane Doe',
        password: STRONG,
      }).success,
    ).toBe(true);
  });

  it('applies the strong schema to change-password, reset, and invitation passwords', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'Old1!pass', newPassword: STRONG }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ currentPassword: 'Old1!pass', newPassword: 'weak' }).success).toBe(false);
    expect(acceptInvitationSchema.safeParse({ token: 't', password: STRONG }).success).toBe(true);
    expect(acceptInvitationSchema.safeParse({ token: 't', password: 'weak' }).success).toBe(false);
  });
});
