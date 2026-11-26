import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@recruitflow/contracts';
import { OffersService } from '../../offers/offers.service';
import { HiringService } from '../hiring.service';

const user: AuthUser = {
  userId: 'rec-1',
  organizationId: 'org-1',
  email: 'rec@sgh.org',
  displayName: 'Recruiter',
  roleCodes: ['RECRUITER'],
  permissions: ['APPLICATION_VIEW', 'CANDIDATE_EDIT'],
};

describe('Ticket 05 — Expected Joining Date & Joining Forecast', () => {
  it('blocks sending an offer when Expected Joining Date is missing on both DTO and current version', async () => {
    const prisma = {
      offer: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'off-1',
          offerCode: 'OFF-1',
          status: 'Approved',
          currentVersionId: 'ver-1',
          applicationId: 'app-1',
          application: { candidate: { firstName: 'Nora', lastName: 'Adel', phone: '+966501111111' }, vacancy: { position: { title: 'RN' } } },
          organization: { name: 'SGH' },
        }),
      },
      offerVersion: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ver-1',
          status: 'Approved',
          proposedJoiningDate: null,
        }),
      },
    };
    const accessControl = { getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: 'org-1' }) };
    const svc = new OffersService(prisma as never, { log: vi.fn() } as never, accessControl as never);
    await expect(
      svc.sendOffer(user, 'off-1', { channel: 'whatsapp', templateId: 'tpl-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('persists Expected Joining Date on send and allows resend with updated date', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      offer: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'off-1',
          offerCode: 'OFF-1',
          status: 'Sent',
          currentVersionId: 'ver-1',
          applicationId: 'app-1',
          application: { candidate: { firstName: 'Nora', lastName: 'Adel', phone: '+966501111111' }, vacancy: { position: { title: 'RN' } } },
          organization: { name: 'SGH' },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      offerVersion: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ver-1',
          status: 'Sent',
          proposedJoiningDate: new Date('2026-12-20T00:00:00.000Z'),
        }),
        updateMany,
      },
      emailTemplate: { findFirst: vi.fn().mockResolvedValue(null) },
      whatsAppTemplate: { findFirst: vi.fn().mockResolvedValue({ id: 'tpl-1', status: 'Active', bodyTemplate: 'Hello {{candidateName}}' }) },
      $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
    };
    const accessControl = { getApplicationVisibilityWhere: vi.fn().mockResolvedValue({ organizationId: 'org-1' }) };
    const svc = new OffersService(prisma as never, { log: vi.fn() } as never, accessControl as never);
    const res = await svc.sendOffer(user, 'off-1', {
      channel: 'whatsapp',
      templateId: 'tpl-1',
      resend: true,
      proposedJoiningDate: '2027-01-10T00:00:00.000Z',
    });
    expect(res.status).toBe('Sent');
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        proposedJoiningDate: new Date('2027-01-10T00:00:00.000Z'),
      }),
    }));
  });

  it('counts each application once across Dec→Jan boundary, distinguishes verified signed vs accepted-unsigned, and excludes actual joiners', async () => {
    const prisma = {
      organization: { findUniqueOrThrow: vi.fn().mockResolvedValue({ timezone: "Africa/Cairo" }) },
      branch: { findFirstOrThrow: vi.fn().mockResolvedValue({ timezone: "Asia/Dubai" }) },
      hiringCase: {
        findMany: vi.fn().mockResolvedValue([
          // app-1 moved from Dec to Jan on HiringCase AND has verified CONTRACT check -> nextMonth (2027-01), signed
          {
            id: 'hc-1',
            applicationId: 'app-1',
            offerId: 'off-1',
            status: 'Awaiting Joining',
            plannedJoiningDate: new Date('2027-01-15T10:00:00.000Z'),
            complianceRequirements: [],
            offer: { status: 'Accepted', versions: [{ proposedJoiningDate: new Date('2026-12-28T10:00:00.000Z') }] },
            application: {
              stage: 'Pre-Hire',
              candidate: { firstName: 'Nora', lastName: 'Adel' },
              primaryRecruiter: { displayName: 'Mariam' },
              joiningChecks: [{ type: 'CONTRACT', verified: true }],
              vacancy: { position: { title: 'RN' }, branch: { id: 'br-1', name: 'Cairo' } },
            },
          },
        ]),
      },
      offer: {
        findMany: vi.fn().mockResolvedValue([
          // Duplicate for app-1 (must NOT be counted a second time in Dec!)
          {
            id: 'off-1',
            applicationId: 'app-1',
            status: 'Accepted',
            versions: [{ proposedJoiningDate: new Date('2026-12-28T10:00:00.000Z') }],
            application: {
              stage: 'Pre-Hire',
              candidate: { firstName: 'Nora', lastName: 'Adel' },
              primaryRecruiter: { displayName: 'Mariam' },
              joiningChecks: [{ type: 'CONTRACT', verified: true }],
              hiringCase: { id: 'hc-1', status: 'Awaiting Joining', plannedJoiningDate: new Date('2027-01-15T10:00:00.000Z') },
              vacancy: { position: { title: 'RN' }, branch: { id: 'br-1', name: 'Cairo' } },
            },
          },
          // app-2 Accepted offer in Dec, NO verified contract check -> thisMonth (2026-12), pendingSignature
          {
            id: 'off-2',
            applicationId: 'app-2',
            status: 'Accepted',
            versions: [{ proposedJoiningDate: new Date('2026-12-22T10:00:00.000Z') }],
            application: {
              stage: 'Offer',
              candidate: { firstName: 'Omar', lastName: 'Tarek' },
              primaryRecruiter: { displayName: 'Mariam' },
              joiningChecks: [{ type: 'CONTRACT', verified: false }],
              hiringCase: null,
              vacancy: { position: { title: 'Pharmacist' }, branch: { id: 'br-1', name: 'Cairo' } },
            },
          },
          // app-3 already Joined hiring case -> excluded from forecast
          {
            id: 'off-3',
            applicationId: 'app-3',
            status: 'Accepted',
            versions: [{ proposedJoiningDate: new Date('2026-12-10T10:00:00.000Z') }],
            application: {
              stage: 'Pre-Hire',
              candidate: { firstName: 'Joined', lastName: 'Person' },
              primaryRecruiter: { displayName: 'Mariam' },
              joiningChecks: [{ type: 'CONTRACT', verified: true }],
              hiringCase: { id: 'hc-3', status: 'Joined', plannedJoiningDate: new Date('2026-12-10T10:00:00.000Z') },
              vacancy: { position: { title: 'Tech' }, branch: { id: 'br-1', name: 'Cairo' } },
            },
          },
        ]),
      },
    };

    const svc = new HiringService(prisma as never, { log: vi.fn() } as never);
    const forecast = await svc.getJoiningForecast('org-1', user, { asOf: '2026-12-15T10:00:00.000Z' });

    const asOf = '2026-11-30T20:30:00Z';
    expect((await svc.getJoiningForecast('org-1', user, { asOf })).thisMonth.month).toBe('2026-11');
    expect((await svc.getJoiningForecast('org-1', user, { branchId: 'dubai', asOf })).thisMonth.month).toBe('2026-12');

    expect(forecast.thisMonth.month).toBe('2026-12');
    expect(forecast.nextMonth.month).toBe('2027-01');
    expect(forecast.thisMonth.total).toBe(1);
    expect(forecast.thisMonth.signed).toBe(0);
    expect(forecast.thisMonth.pendingSignature).toBe(1);
    expect(forecast.thisMonth.items[0].applicationId).toBe('app-2');

    expect(forecast.nextMonth.total).toBe(1);
    expect(forecast.nextMonth.signed).toBe(1);
    expect(forecast.nextMonth.pendingSignature).toBe(0);
    expect(forecast.nextMonth.items[0].applicationId).toBe('app-1');
  });
});
