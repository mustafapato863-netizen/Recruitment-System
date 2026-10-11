/** #34: LICENSE_CHECK without CANDIDATE_EDIT verifies licence items only (else 403 LICENSE_CHECK_SCOPE). */
export function isLicenseCheckOnly(permissions: readonly string[] | undefined, isAdmin = false): boolean {
  const p = permissions ?? [];
  return !isAdmin && p.includes('LICENSE_CHECK') && !p.includes('CANDIDATE_EDIT');
}
export const LICENSE_SCOPE_TEXT = 'You can verify licence checks only. Other checks are completed by the file owner.';
