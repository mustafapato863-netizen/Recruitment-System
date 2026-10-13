const OWNER_KEY = 'recruitflow.public-apply.owner';

export interface ApplyDraft {
  owner: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  currentTitle: string;
  currentCompany: string;
  location: string;
  skills: string;
  consentAccepted: boolean;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 255) : '';
}

export function applyDraftKey(owner: string, organizationCode: string, vacancyCode: string): string {
  return `recruitflow.public-apply.draft.${owner}.${organizationCode}.${vacancyCode}`;
}

export function applyDraftOwner(storage: Pick<Storage, 'getItem' | 'setItem'>): string {
  const existing = storage.getItem(OWNER_KEY);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const created = globalThis.crypto.randomUUID();
  storage.setItem(OWNER_KEY, created);
  return created;
}

export function readApplyDraft(
  storage: Pick<Storage, 'getItem'>,
  owner: string,
  organizationCode: string,
  vacancyCode: string,
): ApplyDraft | null {
  const raw = storage.getItem(applyDraftKey(owner, organizationCode, vacancyCode));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ApplyDraft>;
    if (parsed.owner !== owner) return null;
    return {
      owner,
      firstName: text(parsed.firstName),
      lastName: text(parsed.lastName),
      email: text(parsed.email),
      phone: text(parsed.phone),
      currentTitle: text(parsed.currentTitle),
      currentCompany: text(parsed.currentCompany),
      location: text(parsed.location),
      skills: text(parsed.skills),
      consentAccepted: parsed.consentAccepted === true,
    };
  } catch {
    return null;
  }
}

export function writeApplyDraft(
  storage: Pick<Storage, 'setItem'>,
  organizationCode: string,
  vacancyCode: string,
  draft: ApplyDraft,
): void {
  storage.setItem(applyDraftKey(draft.owner, organizationCode, vacancyCode), JSON.stringify(draft));
}

export function clearApplyDraft(
  storage: Pick<Storage, 'removeItem'>,
  owner: string,
  organizationCode: string,
  vacancyCode: string,
): void {
  storage.removeItem(applyDraftKey(owner, organizationCode, vacancyCode));
}
