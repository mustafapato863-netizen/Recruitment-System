/**
 * One pay rule (B0a + B7): offer pay (base, package, components) AND a candidate's current/expected
 * salary are shown only to holders of OFFER_PAY_VIEW. Everyone else gets the keys OMITTED (absent,
 * never null). Administrators do not hold OFFER_PAY_VIEW (seed), so they see no pay.
 * VIEW_CURRENT_SALARY stays in the catalog but no longer reveals pay on its own.
 */
export const PAY_VIEW_PERMISSION = 'OFFER_PAY_VIEW';

export interface PayPermissionChecker {
  hasPermission(userId: string, organizationId: string, code: string): Promise<boolean>;
}

/** True when this caller may see pay (offer pay and current/expected salary). */
export async function canSeePay(checker: PayPermissionChecker | undefined | null, user: { userId: string; organizationId: string }): Promise<boolean> {
  if (!checker) return false;
  return Boolean(await checker.hasPermission(user.userId, user.organizationId, PAY_VIEW_PERMISSION));
}
