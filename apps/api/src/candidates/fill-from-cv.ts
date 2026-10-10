import type { ExtractedCandidate } from '@recruitflow/contracts';
import { catalogKey } from '../master-data/catalog-normalization';
import { contactKeys, normalizeEmailKey, normalizePhoneKey } from './contact-keys';

export interface FillConflict { field: string; existing: unknown; incoming: unknown }
export interface FillPlan { data: Record<string, unknown>; filled: string[]; conflicts: FillConflict[] }

type Existing = Record<string, unknown> & { skills?: string[] | null };

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && !v.trim());

/**
 * E3: fill EMPTY candidate fields from a parsed CV. Never overwrites: a different non-empty value is a conflict.
 * Same rules as the import link path (B6): email/phone compared by normalized key, text case-insensitively,
 * list fields (certifications, languages) fill an empty list only, skills are added (never removed).
 */
export function planFillFromCv(existing: Existing, parsed: ExtractedCandidate): FillPlan {
  const data: Record<string, unknown> = {};
  const filled: string[] = [];
  const conflicts: FillConflict[] = [];
  const email = parsed.email ? normalizeEmailKey(parsed.email) : null;
  const scalars: Record<string, string | number | null> = {
    firstName: str(parsed.firstName), lastName: str(parsed.lastName), email, phone: str(parsed.phone),
    currentTitle: str(parsed.title), currentCompany: str(parsed.currentCompany),
    experienceYears: typeof parsed.experienceYears === 'number' && Number.isFinite(parsed.experienceYears) ? Math.round(parsed.experienceYears) : null,
    location: str(parsed.location), summary: str(parsed.summary),
  };
  for (const [field, value] of Object.entries(scalars)) {
    if (value === null) continue;
    const current = existing[field];
    if (isEmpty(current)) { data[field] = value; filled.push(field); continue; }
    const same = field === 'email' ? normalizeEmailKey(String(current)) === value
      : field === 'phone' ? normalizePhoneKey(String(current)) === normalizePhoneKey(String(value))
      : String(current).trim().toLowerCase() === String(value).trim().toLowerCase();
    if (!same) conflicts.push({ field, existing: current, incoming: value });
  }
  for (const field of ['certifications', 'languages'] as const) {
    const clean = [...new Set((parsed[field] ?? []).filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()))];
    if (!clean.length) continue;
    const current = Array.isArray(existing[field]) ? (existing[field] as string[]) : [];
    if (!current.length) { data[field] = clean; filled.push(field); continue; }
    const same = current.length === clean.length && current.every((c) => clean.some((x) => catalogKey(x) === catalogKey(c)));
    if (!same) conflicts.push({ field, existing: current, incoming: clean });
  }
  const skills = [...(existing.skills ?? [])];
  for (const sk of parsed.skills ?? []) if (typeof sk === 'string' && sk.trim() && !skills.some((x) => catalogKey(x) === catalogKey(sk))) skills.push(sk.trim());
  if (skills.length !== (existing.skills ?? []).length) { data.skills = skills; filled.push('skills'); }
  if ('email' in data || 'phone' in data) {
    Object.assign(data, contactKeys((data.email ?? existing.email) as string | null, (data.phone ?? existing.phone) as string | null));
  }
  return { data, filled, conflicts };
}
