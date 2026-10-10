/**
 * E2 pay safety (Roadmap: Employees never see or send pay). Every response the
 * application file reads goes through stripPay() before it reaches state, so a
 * pay field the API happens to return can never render, even by accident.
 */
const PAY_KEY = /salary|^pay|pay$|package|compensation|currency|^amount$|annualfixed|monthlypackage|allowance|bonus|^components$|packagetotal|grade(band)?(min|max)/i;

export function isPayKey(key: string): boolean {
  return PAY_KEY.test(key);
}

export function stripPay<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripPay(v)) as unknown as T;
  if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof Blob)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isPayKey(k)) continue;
      out[k] = stripPay(v);
    }
    return out as T;
  }
  return value;
}
