/**
 * B6: candidate contact keys. MUST match the SQL functions rf_normalize_email /
 * rf_normalize_phone in migration 20261010_b6_suggest_compare (a DB trigger keeps
 * candidates.emailNormalized / phoneNormalized in sync on every write).
 *
 * Email: lower(trim), empty -> null.
 * Phone (E.164-ish, default country 966):
 *   "+..." or "00..." -> international; leading "0" -> 966 + rest;
 *   <= 9 digits -> 966 + digits; otherwise digits already carry a country code.
 *   Valid when 8..15 digits -> "+<digits>", else null.
 */
export const DEFAULT_PHONE_COUNTRY = '966';

export function normalizeEmailKey(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().toLowerCase();
  return value || null;
}

export function normalizePhoneKey(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  let d = s.replace(/\D/g, '');
  if (!d) return null;
  if (s.startsWith('+')) {
    // already international
  } else if (d.startsWith('00')) {
    d = d.slice(2);
  } else if (d.startsWith('0')) {
    d = DEFAULT_PHONE_COUNTRY + d.slice(1);
  } else if (d.length <= 9) {
    d = DEFAULT_PHONE_COUNTRY + d;
  }
  if (d.length < 8 || d.length > 15) return null;
  return `+${d}`;
}
