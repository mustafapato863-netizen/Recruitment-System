import type { UserProfile } from '@recruitflow/contracts';

/**
 * True when the signed-in account must pick a new password before using a
 * workspace (first sign-in after an admin-created account, or after an
 * admin reset). The flag arrives on UserProfile from /auth/me (contracts
 * UserProfile.mustChangePassword).
 */
export function mustChangePassword(user: UserProfile | null | undefined): boolean {
  return user?.mustChangePassword === true;
}
