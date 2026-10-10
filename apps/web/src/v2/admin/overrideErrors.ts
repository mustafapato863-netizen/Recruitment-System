/**
 * B2F-4: an admin override that answers 403 is NOT "only an administrator can use an override" — the caller is one.
 * Say what the API refused, by code; the server's own message wins. The api client masks generic 403 messages,
 * so the body (ApiError.details) is read here.
 */
export function override403Text(e: unknown): string {
  const x = e as { code?: string; details?: { code?: string; message?: string } } | null;
  const code = x?.details?.code ?? x?.code ?? '';
  const server = (x?.details?.message ?? '').trim();
  if (code === 'JOB_NOT_OWNED' || /owner or their manager/i.test(server)) {
    return `The server refused this override: ${server || 'only the job owner or their manager can change job status.'} The API does not accept admin overrides on job status yet; ask the owner or their manager, or retry once Backend enables it.`;
  }
  if (code === 'ADMIN_CANNOT_CHANGE_JOB_STATUS') return server || 'An administrator can’t change job status directly, and the server refused the override.';
  if (code === 'ADMIN_ONLY') return server || 'This override needs the Administrator role.';
  if (code === 'OVERRIDE_NOT_ALLOWED') return server || 'That override is not allowed for this record now.';
  return server ? `The server refused this override (${code || '403'}): ${server}` : `The server refused this override (${code || '403'}). Nothing changed.`;
}
