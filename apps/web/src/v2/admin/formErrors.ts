import { bannerError, serverFormErrors } from '../forms/serverErrors';

/**
 * #23: map a failed save to the form's own error keys. `map` = API body path → form key ("minMonthlyBase" → "min",
 * "rows" → "name" for "rows.0.name"). Inline messages for mapped paths; `form` keeps the message nothing else shows.
 */
export function toFormErrs(e: unknown, map: Record<string, string>, fallback: string): Record<string, string> {
  const f = serverFormErrors(e);
  const out: Record<string, string> = {};
  const keys = Object.keys(f.byField);
  for (const k of keys) { const to = map[k] ?? map[k.split('.')[0]]; if (to && !out[to]) out[to] = f.byField[k]; }
  const banner = keys.length ? bannerError(f, keys.filter((k) => map[k] ?? map[k.split('.')[0]])) : f.message || fallback;
  if (banner) out.form = banner;
  return out;
}
