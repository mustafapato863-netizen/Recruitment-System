import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@recruitflow/contracts';
import type { PrismaService } from '../../database/prisma.service';
import type { AccessControlService } from '../../access-control/access-control.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import { OffersService } from '../offers.service';

const ORG = '10000000-0000-4000-8000-000000000001';
const user: AuthUser = { userId: 'u1', organizationId: ORG, tokenVersion: 1, roleCodes: ['RECRUITER'] };
const PAY_KEYS = ['monthlyPackage', 'annualFixed', 'amount', 'packageCurrency'];
const now = new Date('2026-10-01T10:00:00Z');

const version = {
  id: 'v1', offerId: 'o1', versionNumber: 1, monthlyPackage: 20000, annualFixed: 240000, contractType: 'Permanent',
  probationPeriod: '3 months', offerExpiry: null, proposedJoiningDate: null, workLocation: 'Cairo', workingSchedule: null,
  approvalStatus: 'Pending', isLocked: false, createdAt: now,
  components: [{ id: 'c1', type: 'Salary', name: 'Basic', amount: 20000, currency: 'EGP', frequency: 'Monthly', isTaxable: true }],
  approvals: [],
};
const offer = {
  id: 'o1', organizationId: ORG, applicationId: 'a1', offerCode: 'OFF-1', status: 'Draft', currentVersionId: 'v1',
  createdAt: now, updatedAt: now,
  application: { candidate: { firstName: 'Lina', lastName: 'Hassan' }, vacancy: { id: 'vac', location: null, position: { title: 'HRIS Developer' }, branch: { name: 'Offshore' } } },
  versions: [version],
};

function makeService() {
  const prisma = {
    offer: { findMany: vi.fn().mockResolvedValue([offer]), findFirst: vi.fn().mockResolvedValue(offer) },
    offerApproval: {
      findMany: vi.fn().mockResolvedValue([{ id: 'ap1', offerVersionId: 'v1', roleCode: 'HR_MANAGER', status: 'Pending',
        offerVersion: { ...version, offer } }]),
    },
  };
  const accessControl = { getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }), getApplicationReadVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: ORG }) };
  return new OffersService(prisma as unknown as PrismaService, {} as NotificationsService, accessControl as unknown as AccessControlService);
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => collectKeys(v, keys));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { keys.add(k); collectKeys(v, keys); }
  return keys;
}

describe('Offer pay disclosure', () => {
  it('omits pay keys from list, detail and approval inbox for users without OFFER_PAY_VIEW', async () => {
    const service = makeService();
    const payloads = [
      await service.getOffers(user, {}, { viewOfferPay: false }),
      await service.getOfferById(user, 'o1', { viewOfferPay: false }),
      await service.getApprovalInbox(user, { viewOfferPay: false }),
    ];
    for (const payload of payloads) {
      const keys = collectKeys(payload);
      for (const key of PAY_KEYS) expect(keys.has(key)).toBe(false);
      expect(JSON.stringify(payload)).not.toContain('20000');
    }
  });

  it('keeps pay for users with OFFER_PAY_VIEW', async () => {
    const service = makeService();
    const detail = await service.getOfferById(user, 'o1', { viewOfferPay: true });
    expect(detail.currentVersion).toMatchObject({ monthlyPackage: 20000, annualFixed: 240000 });
    expect(detail.currentVersion?.components[0]).toMatchObject({ amount: 20000 });
    const [inbox] = await service.getApprovalInbox(user, { viewOfferPay: true });
    expect(inbox).toMatchObject({ monthlyPackage: 20000, packageCurrency: 'EGP' });
  });
});
