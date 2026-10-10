/**
 * B6: candidate contact keys. Rules MUST match the SQL functions
 * rf_normalize_email(raw) / rf_normalize_phone(raw, cc) in migration
 * 20261010_b6_suggest_compare (parity is tested against Postgres).
 *
 * Email: lower(trim), empty -> null.
 * Phone (E.164-ish), cc = default country calling code:
 *   "+..." or "00..." -> international; leading "0" -> cc + rest;
 *   <= 9 digits -> cc + digits; otherwise digits already carry a country code.
 *   Valid when 8..15 digits -> "+<digits>", else null. With no cc, local formats -> null.
 *
 * The default country code is configuration, not code: env DEFAULT_PHONE_COUNTRY_CODE
 * (1-3 digits). There is no org settings table today; FALLBACK_COUNTRY_CODE applies
 * only when the env var is unset or invalid.
 */
export const FALLBACK_COUNTRY_CODE = '966';

export function defaultPhoneCountryCode(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.DEFAULT_PHONE_COUNTRY_CODE ?? '').trim().replace(/^\+/, '');
  return /^\d{1,3}$/.test(raw) ? raw : FALLBACK_COUNTRY_CODE;
}

export function normalizeEmailKey(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().toLowerCase();
  return value || null;
}

export function normalizePhoneKey(raw: string | null | undefined, cc: string | null = defaultPhoneCountryCode()): string | null {
  const s = (raw ?? '').trim();
  let d = s.replace(/\D/g, '');
  if (!d) return null;
  if (s.startsWith('+')) {
    // already international
  } else if (d.startsWith('00')) {
    d = d.slice(2);
  } else if (d.startsWith('0')) {
    if (!cc) return null;
    d = cc + d.slice(1);
  } else if (d.length <= 9) {
    if (!cc) return null;
    d = cc + d;
  }
  if (d.length < 8 || d.length > 15) return null;
  return `+${d}`;
}

/** Keys to write alongside email/phone on every candidate create/update. */
export function contactKeys(email: string | null | undefined, phone: string | null | undefined) {
  return { emailNormalized: normalizeEmailKey(email), phoneNormalized: normalizePhoneKey(phone) };
}

/**
 * Recomputes keys in SQL with the configured cc (catches seed/fixture/raw writes,
 * migration rows left NULL for lack of a cc, and a changed DEFAULT_PHONE_COUNTRY_CODE).
 */
export async function repairContactKeys(
  prisma: { $executeRawUnsafe: (sql: string, ...values: unknown[]) => Promise<number> },
  cc: string = defaultPhoneCountryCode(),
): Promise<number> {
  return prisma.$executeRawUnsafe(
    `UPDATE "candidates" SET "emailNormalized" = rf_normalize_email("email"), "phoneNormalized" = rf_normalize_phone("phone", $1)
     WHERE "emailNormalized" IS DISTINCT FROM rf_normalize_email("email") OR "phoneNormalized" IS DISTINCT FROM rf_normalize_phone("phone", $1)`,
    cc,
  );
}
