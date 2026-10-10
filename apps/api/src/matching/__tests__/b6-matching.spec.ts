import { describe, expect, it } from 'vitest';
import { normalizeEmailKey, normalizePhoneKey } from '../../candidates/contact-keys';
import { findSkillSnippet } from '../skill-evidence';
import { SUGGESTION_ORDER } from '../matching.service';
import { MasterDataService } from '../../master-data/master-data.service';

describe('B6 contact keys', () => {
  it('lowercases and trims email', () => {
    expect(normalizeEmailKey('  Dup.Person@Example.COM ')).toBe('dup.person@example.com');
    expect(normalizeEmailKey('   ')).toBeNull();
  });
  it('normalizes phones to E.164-ish with default country 966', () => {
    for (const raw of ['0501234567', '+966 50 123 4567', '00966-501-234-567', '501234567', '966501234567', '(050) 123-4567']) {
      expect(normalizePhoneKey(raw)).toBe('+966501234567');
    }
    expect(normalizePhoneKey('+20 100 123 4567')).toBe('+201001234567');
    expect(normalizePhoneKey('1234')).toBeNull();
    expect(normalizePhoneKey('')).toBeNull();
  });
});

describe('B6 evidence snippets', () => {
  it('matches a whole phrase, case and whitespace insensitive, with context', () => {
    expect(findSkillSnippet('Five years in the ICU at King Fahad.', 'icu')).toContain('ICU');
    expect(findSkillSnippet('Worked in Critical\n  Care units', 'Critical Care')).toBe('Worked in Critical Care units');
    expect(findSkillSnippet('PICU nurse', 'ICU')).toBeNull();
    expect(findSkillSnippet(null, 'ICU')).toBeNull();
  });
});

describe('B6 ordering is documented, not scored', () => {
  it('lists the order in words with no numbers or percents', () => {
    expect(SUGGESTION_ORDER.length).toBeGreaterThan(2);
    for (const rule of SUGGESTION_ORDER) expect(rule).not.toMatch(/%|\d|score|percent/i);
  });
});

describe('B6 skill library is deactivate-only', () => {
  it('DELETE on a skill sets it Inactive and never deletes', async () => {
    const calls: string[] = [];
    const prisma = {
      masterDataValue: {
        findFirst: async () => ({ id: 's1' }),
        update: async (args: { data: { status: string } }) => { calls.push(`update:${args.data.status}`); return {}; },
        delete: async () => { calls.push('delete'); return {}; },
      },
    };
    const svc = new MasterDataService(prisma as never);
    await expect(svc.deleteCatalogValue('org', 'skills', 's1')).resolves.toEqual({ id: 's1', deactivated: true, status: 'Inactive' });
    expect(calls).toEqual(['update:Inactive']);
  });
});
