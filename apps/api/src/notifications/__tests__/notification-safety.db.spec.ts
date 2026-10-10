/** Offer/interview notifications carry applicationId; Employees never get pay in the text. Scratch Postgres (B5_TEST_DATABASE_URL). */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications.service';

const url = process.env.B5_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

describe.skipIf(!url)('notification safety (scratch Postgres)', () => {
  let prisma: PrismaService;
  let svc: NotificationsService;
  const employee = randomUUID();
  let applicationId = ''; let offerId = ''; let interviewId = '';

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    svc = new NotificationsService(prisma, { enqueueWithTx: async () => undefined } as never);
    const role = await prisma.role.findFirstOrThrow({ where: { code: 'RECRUITER' } });
    await prisma.user.create({ data: { id: employee, organizationId: ORG, email: `ns-${tag}@t.test`, emailNormalized: `ns-${tag}@t.test`, displayName: 'NS', passwordHash: 'x', emailNotifications: false, userRoles: { create: { roleId: role.id } } } });
    const app = await prisma.application.findFirstOrThrow({ where: { organizationId: ORG } });
    applicationId = app.id;
    offerId = (await prisma.offer.create({ data: { organizationId: ORG, applicationId, offerCode: `OFF-NS-${tag}`, status: 'Draft' } })).id;
    interviewId = (await prisma.interview.create({ data: { organizationId: ORG, applicationId, interviewCode: `NS-${tag}`, title: 'NS', interviewType: 'Technical', scheduledStart: new Date('2031-01-01T08:00:00Z'), scheduledEnd: new Date('2031-01-01T09:00:00Z') } as never })).id;
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('employee: offer text has no pay; offer and interview notifications carry applicationId', async () => {
    await svc.create({ organizationId: ORG, recipientUserId: employee, type: 'OfferManagerDecision', title: 'Offer rejected', message: `OFF-NS-${tag} v1: Reject (base AED 16,000 above 15000 max)`, entityType: 'Offer', entityId: offerId });
    await svc.create({ organizationId: ORG, recipientUserId: employee, type: 'InterviewScheduled', title: 'Interview booked', message: 'Tomorrow 10:00', entityType: 'Interview', entityId: interviewId });
    await svc.create({ organizationId: ORG, recipientUserId: employee, type: 'TaskAssigned', title: 'Task', message: 'Call 12000 times', entityType: 'Task', entityId: randomUUID() });
    const stored = await prisma.notification.findFirstOrThrow({ where: { recipientUserId: employee, type: 'OfferManagerDecision' } });
    expect(stored.message).not.toMatch(/16,000|15000/);
    // Older rows written with pay are stripped on read too.
    await prisma.notification.create({ data: { organizationId: ORG, recipientUserId: employee, type: 'OfferStatusChanged', title: 'Offer', message: 'Package 18,500 SAR', entityType: 'Offer', entityId: offerId } });
    const list = await svc.list(ORG, employee, false, 1, 50);
    const byType = Object.fromEntries(list.data.map((n) => [n.type, n]));
    expect(byType.OfferManagerDecision).toMatchObject({ applicationId });
    expect(byType.InterviewScheduled).toMatchObject({ applicationId });
    expect(byType.OfferStatusChanged!.message).toBe('Package [pay hidden]');
    expect(byType.TaskAssigned!.message).toBe('Call 12000 times');
    expect('applicationId' in byType.TaskAssigned!).toBe(false);
    expect(JSON.stringify(list.data)).not.toMatch(/16,000|18,500/);
  });

  it('B7: a manager with OFFER_PAY_VIEW keeps the pay text; the owner (Employee) never sees it', async () => {
    const mgr = randomUUID();
    const role = await prisma.role.findFirstOrThrow({ where: { code: 'HIRING_MANAGER' } });
    await prisma.user.create({ data: { id: mgr, organizationId: ORG, email: `nsm-${tag}@t.test`, emailNormalized: `nsm-${tag}@t.test`, displayName: 'NSM', passwordHash: 'x', emailNotifications: false, userRoles: { create: { roleId: role.id } } } });
    const msg = `OFF-NS-${tag} v2: Reject (base AED 16,000 above band)`;
    for (const r of [mgr, employee]) await svc.create({ organizationId: ORG, recipientUserId: r, type: 'OfferManagerDecision', title: 'Offer rejected', message: msg, entityType: 'Offer', entityId: `${offerId}` });
    expect((await svc.list(ORG, mgr, false, 1, 10)).data[0]!.message).toBe(msg);
    expect(JSON.stringify((await svc.list(ORG, employee, false, 1, 50)).data)).not.toContain('16,000');
  });
});
