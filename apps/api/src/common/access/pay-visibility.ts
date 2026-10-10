/**
 * Two explicit rules (B0a + B7). Without the permission, the keys are OMITTED (absent, never null).
 * - Offer pay (base, package, components): OFFER_PAY_VIEW via canSeePay. Administrators don't hold it (seed).
 * - A candidate's current/expected salary: VIEW_CURRENT_SALARY via canSeeCurrentSalary.
 * Neither permission reveals the other.
 */
export const PAY_VIEW_PERMISSION = 'OFFER_PAY_VIEW';

export interface PayPermissionChecker {
  hasPermission(userId: string, organizationId: string, code: string): Promise<boolean>;
}

/** True when this caller may see offer pay. */
export async function canSeePay(checker: PayPermissionChecker | undefined | null, user: { userId: string; organizationId: string }): Promise<boolean> {
  if (!checker) return false;
  return Boolean(await checker.hasPermission(user.userId, user.organizationId, PAY_VIEW_PERMISSION));
}

export const CURRENT_SALARY_PERMISSION = 'VIEW_CURRENT_SALARY';

/** True when this caller may see a candidate's current/expected salary. */
export async function canSeeCurrentSalary(checker: PayPermissionChecker | undefined | null, user: { userId: string; organizationId: string }): Promise<boolean> {
  if (!checker) return false;
  return Boolean(await checker.hasPermission(user.userId, user.organizationId, CURRENT_SALARY_PERMISSION));
}
