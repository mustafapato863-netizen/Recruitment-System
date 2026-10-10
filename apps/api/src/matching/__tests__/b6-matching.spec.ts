import { describe, expect, it } from 'vitest';
import { contactKeys, defaultPhoneCountryCode, normalizeEmailKey, normalizePhoneKey } from '../../candidates/contact-keys';
import { vi } from 'vitest';
import { MatchingService } from '../matching.service';
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
  });
  it('country code is configuration: DEFAULT_PHONE_COUNTRY_CODE, fallback only when unset/invalid', () => {
    expect(defaultPhoneCountryCode({})).toBe('966');
    expect(defaultPhoneCountryCode({ DEFAULT_PHONE_COUNTRY_CODE: '+20' })).toBe('20');
    expect(defaultPhoneCountryCode({ DEFAULT_PHONE_COUNTRY_CODE: 'abc' })).toBe('966');
    expect(normalizePhoneKey('01001234567', '20')).toBe('+201001234567');
    expect(normalizePhoneKey('0501234567', null)).toBeNull();
    expect(normalizePhoneKey('+966501234567', null)).toBe('+966501234567');
    const before = process.env.DEFAULT_PHONE_COUNTRY_CODE;
    process.env.DEFAULT_PHONE_COUNTRY_CODE = '20';
    try {
      expect(contactKeys(' A@B.co ', '0100 123 4567')).toEqual({ emailNormalized: 'a@b.co', phoneNormalized: '+201001234567' });
    } finally {
      if (before === undefined) delete process.env.DEFAULT_PHONE_COUNTRY_CODE; else process.env.DEFAULT_PHONE_COUNTRY_CODE = before;
    }
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

describe('B6 auto-derive is non-blocking and never throws', () => {
  it('logs and swallows a failure, resolves the candidate from an interview', async () => {
    const prisma = { interview: { findFirst: vi.fn().mockResolvedValue({ application: { candidateId: 'c1' } }) } };
    const svc = new MatchingService(prisma as never, {} as never);
    const derive = vi.spyOn(svc, 'deriveEvidence').mockRejectedValue(new Error('boom'));
    const warn = vi.spyOn((svc as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn').mockImplementation(() => undefined);
    const p = svc.deriveEvidenceInBackground('org', { interviewId: 'i1' }, 'u1', 'scorecard submit');
    expect(derive).not.toHaveBeenCalled(); // deferred past the caller's commit
    await expect(p).resolves.toBeUndefined();
    expect(derive).toHaveBeenCalledWith('org', 'c1', 'u1');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('scorecard submit failed: boom'));
  });
});
