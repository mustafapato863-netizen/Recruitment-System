import { describe, expect, it } from 'vitest';
import {
  STRONG_PASSWORD_MIN_LENGTH,
  evaluateStrongPassword,
  generateStrongPassword,
} from '../passwordPolicy';

/**
 * Parity cases for the strong password policy (min length 10, upper, lower,
 * digit, symbol, no email local part). The backend enforces the identical
 * set; if either side changes a rule, these cases must change with it.
 */
describe('evaluateStrongPassword', () => {
  it('requires at least 10 characters (9 fails, 10 passes at the boundary)', () => {
    expect(evaluateStrongPassword('Ab1!defgh').valid).toBe(false);
    expect(evaluateStrongPassword('Ab1!defgh').rules.find((r) => r.id === 'length')?.passed).toBe(false);
    expect(evaluateStrongPassword('Ab1!defghi').valid).toBe(true);
  });

  it('requires each character class', () => {
    expect(evaluateStrongPassword('abcdefghi1!').rules.find((r) => r.id === 'uppercase')?.passed).toBe(false);
    expect(evaluateStrongPassword('ABCDEFGHI1!').rules.find((r) => r.id === 'lowercase')?.passed).toBe(false);
    expect(evaluateStrongPassword('Abcdefghi!').rules.find((r) => r.id === 'digit')?.passed).toBe(false);
    expect(evaluateStrongPassword('Abcdefghi1').rules.find((r) => r.id === 'special')?.passed).toBe(false);
    expect(evaluateStrongPassword('Abcdefghi1!').valid).toBe(true);
  });

  it('rejects a password containing the email local part (and ignores short local parts)', () => {
    const withEmail = evaluateStrongPassword('Sarah.ahmed1!', 'sarah.ahmed@recruitflow.local');
    expect(withEmail.rules.find((r) => r.id === 'email')?.passed).toBe(false);
    expect(withEmail.valid).toBe(false);
    expect(evaluateStrongPassword('Sarah123!x', 'ab@recruitflow.local').valid).toBe(true);
    expect(evaluateStrongPassword('Sarah123!x').rules.some((r) => r.id === 'email')).toBe(false);
  });

  it('reports strength labels and the unmet rules', () => {
    const weak = evaluateStrongPassword('abc');
    expect(weak.strength).toBe('weak');
    expect(weak.strengthLabel).toBe('Weak');
    expect(weak.unmetLabels).toContain('At least 10 characters');
    const strong = evaluateStrongPassword('Abcdefghi1!');
    expect(strong.strength).toBe('strong');
    expect(strong.unmetLabels).toHaveLength(0);
  });

  it('counts the minimum length as 10', () => {
    expect(STRONG_PASSWORD_MIN_LENGTH).toBe(10);
  });

  it('rejects passwords over 128 characters (shared max-length rule)', () => {
    const tooLong = evaluateStrongPassword(`A1!${'a'.repeat(126)}`);
    expect(tooLong.valid).toBe(false);
    expect(tooLong.unmetLabels).toContain('At most 128 characters');
    expect(evaluateStrongPassword(`A1!${'a'.repeat(125)}`).valid).toBe(true);
  });
});

describe('generateStrongPassword', () => {
  it('always generates a password that passes the policy', () => {
    for (let i = 0; i < 20; i += 1) {
      const generated = generateStrongPassword();
      expect(generated.length).toBeGreaterThanOrEqual(16);
      expect(evaluateStrongPassword(generated).valid).toBe(true);
    }
  });

  it('generates distinct passwords', () => {
    const values = new Set(Array.from({ length: 10 }, () => generateStrongPassword()));
    expect(values.size).toBeGreaterThan(1);
  });
});
