/** Pull a portal token out of a pasted receipt link. A bare application code is not a token. */
export function parsePortalToken(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;
  if (/^APP-\d{4}-\d+$/i.test(value)) return null;
  try {
    const url = new URL(value, 'http://127.0.0.1');
    const parts = url.pathname.split('/').filter(Boolean);
    const applications = parts.indexOf('applications');
    if (parts[0] === 'portal' && applications >= 0 && parts[applications + 1]) {
      return decodeURIComponent(parts[applications + 1]);
    }
    const queryToken = url.searchParams.get('token');
    if (queryToken && queryToken.includes('.')) return queryToken;
  } catch {
    // A raw token is handled below.
  }
  if (value.includes('.') && !value.includes('/')) return value;
  return null;
}
