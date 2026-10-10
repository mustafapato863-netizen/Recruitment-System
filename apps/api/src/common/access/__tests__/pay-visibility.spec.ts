import { describe, expect, it } from 'vitest';
import { canSeeCurrentSalary, canSeePay, PAY_VIEW_PERMISSION } from '../pay-visibility';
import { OFFER_PAY_PERMISSION } from '../../../notifications/notification-safety';

// Two explicit rules: offer pay (OFFER_PAY_VIEW) and current/expected salary (VIEW_CURRENT_SALARY).
describe('canSeePay', () => {
  const grants: Record<string, string[]> = {
    manager: ['OFFER_PAY_VIEW'], // Hiring Manager (seed): offer pay, no current salary
    admin: ['VIEW_CURRENT_SALARY', 'ROLES_MANAGE'], // seeded admins never hold OFFER_PAY_VIEW
    employee: ['APPLICATION_VIEW'],
  };
  const checker = { hasPermission: async (userId: string, _org: string, code: string) => grants[userId]?.includes(code) ?? false };
  const as = (userId: string) => ({ userId, organizationId: 'o' });

  it('only OFFER_PAY_VIEW holders see pay; VIEW_CURRENT_SALARY alone (e.g. admin) does not', async () => {
    expect(await canSeePay(checker, as('manager'))).toBe(true);
    expect(await canSeePay(checker, as('admin'))).toBe(false);
    expect(await canSeePay(checker, as('employee'))).toBe(false);
    expect(await canSeePay(undefined, as('manager'))).toBe(false);
  });

  it('current/expected salary: VIEW_CURRENT_SALARY only (admin yes, Hiring Manager no)', async () => {
    expect(await canSeeCurrentSalary(checker, as('admin'))).toBe(true);
    expect(await canSeeCurrentSalary(checker, as('manager'))).toBe(false);
    expect(await canSeeCurrentSalary(checker, as('employee'))).toBe(false);
    expect(await canSeeCurrentSalary(undefined, as('admin'))).toBe(false);
  });

  it('notifications use the offer-pay permission', () => {
    expect(OFFER_PAY_PERMISSION).toBe(PAY_VIEW_PERMISSION);
  });
});
