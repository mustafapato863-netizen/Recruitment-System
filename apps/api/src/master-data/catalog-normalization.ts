/**
 * Canonical text helpers shared by Master Data write paths.
 * They deliberately preserve the user's casing while removing formatting
 * differences that should not create a second catalog value.
 */
export function normalizeCatalogText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function catalogKey(value: string | null | undefined): string {
  return normalizeCatalogText(value).toLocaleLowerCase('en-US');
}

/** Keep the branch city catalogue consistent after the Offshore label was renamed to Cairo. */
export function normalizeBranchCity(value: string | null | undefined): string | null {
  const city = normalizeCatalogText(value);
  if (!city) return null;
  return catalogKey(city) === 'offshore' ? 'Cairo' : city;
}

export function uniqueCatalogNames(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of values) {
    const name = normalizeCatalogText(raw);
    const key = catalogKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}
