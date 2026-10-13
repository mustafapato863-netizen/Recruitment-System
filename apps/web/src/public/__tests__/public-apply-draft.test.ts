import { describe, expect, it } from 'vitest';
import { applyDraftKey, applyDraftOwner, readApplyDraft, writeApplyDraft } from '../public-apply-draft';
import { parsePortalToken } from '../portal-link';

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

describe('public application draft', () => {
  it('keeps one person\'s draft off the next person\'s form', () => {
    const storage = memory();
    const ownerA = applyDraftOwner(storage);
    writeApplyDraft(storage, 'SGH', 'VAC-2026-P8', {
      owner: ownerA,
      firstName: 'Phase',
      lastName: 'One',
      email: 'phase8.one@recruitflow.local',
      phone: '',
      currentTitle: '',
      currentCompany: '',
      location: '',
      skills: '',
      consentAccepted: false,
    });
    const ownerB = '11111111-1111-4111-8111-111111111111';
    expect(readApplyDraft(storage, ownerB, 'SGH', 'VAC-2026-P8')).toBeNull();
    expect(readApplyDraft(storage, ownerA, 'SGH', 'VAC-2026-P8')?.firstName).toBe('Phase');
    expect(applyDraftKey(ownerA, 'SGH', 'VAC-2026-P8')).not.toBe(applyDraftKey(ownerB, 'SGH', 'VAC-2026-P8'));
  });
});

describe('portal link parsing', () => {
  it('rejects a bare application reference', () => {
    expect(parsePortalToken('APP-2026-001')).toBeNull();
    expect(parsePortalToken('https://127.0.0.1/portal/applications/aaa.bbb') ).toBe('aaa.bbb');
  });
});
