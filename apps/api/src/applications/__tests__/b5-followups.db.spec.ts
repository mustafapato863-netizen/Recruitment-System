/**
 * B5 follow-ups (#11) against a real Postgres. Skipped unless B5_TEST_DATABASE_URL is set.
 * NEVER point this at production.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { OffersService } from '../../offers/offers.service';
import { HiringService } from '../../hiring/hiring.service';
import { ApplicationFileService } from '../application-file.service';
import { GATE_CODES, assertStageGate } from '../application-gates';

const url = process.env.B5_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

async function err(p: Promise<unknown>): Promise<{ status: number | string; code?: string }> {
  try { await p; return { status: 'ok' }; } catch (e) {
    const r = ((e as { getResponse?: () => unknown }).getResponse?.() ?? {}) as { code?: string };
    return { status: (e as { getStatus?: () => number }).getStatus?.() ?? (e as Error).message, code: r.code };
  }
}

describe.skipIf(!url)('B5 follow-ups: offer Draft/submit/send, approver note + grade, filters, follow-up date, typed joining checks, documents', () => {
  let prisma: PrismaService;
  let offers: OffersService;
  let file: ApplicationFileService;
  const ids: Record<string, string> = {};
  const queued: Array<Record<string, unknown>> = [];
  const outbox = { enqueueWithTx: async (_tx: unknown, input: Record<string, unknown>) => { queued.push(input); } };
  const visibleOnly: { ids: string[] | null } = { ids: null };
  const access = { getApplicationVisibilityWhere: async (u: { organizationId: string }) => ({ organizationId: u.organizationId, ...(visibleOnly.ids ? { id: { in: visibleOnly.ids } } : {}) }) };
  const notifications = { create: async () => undefined };
  const user = (userId: string, roleCodes = ['RECRUITER']) => ({ userId, organizationId: ORG, tokenVersion: 0, roleCodes });
  let gradeId = '';

  async function newApplication(stage: string, extra: Record<string, unknown> = {}) {
    const vacancy = await prisma.vacancy.findFirstOrThrow({ where: { organizationId: ORG, status: 'Open' }, orderBy: { createdAt: 'asc' } });
    const cand = randomUUID();
    await prisma.candidate.create({ data: { id: cand, organizationId: ORG, candidateCode: `B5F-${tag}-${cand.slice(0, 6)}`, firstName: 'Lina', lastName: 'Haddad', email: `lina-${cand.slice(0, 6)}@b5.test`, phone: '+971501112233', ...extra } });
    return prisma.application.create({ data: { organizationId: ORG, applicationCode: `B5F-${tag}-${cand.slice(0, 6)}`, vacancyId: vacancy.id, candidateId: cand, stage, primaryRecruiterId: ids.owner } });
  }
  const create = (applicationId: string) => offers.createOffer(user(ids.owner!), { applicationId, components: [{ type: 'Salary', name: 'Basic', amount: 12000, currency: 'AED', frequency: 'Monthly', isTaxable: true }] } as never);

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    offers = new OffersService(prisma, notifications as never, access as never, outbox as never);
    file = new ApplicationFileService(prisma, access as never);
    const recruiter = await prisma.role.findFirstOrThrow({ where: { code: 'RECRUITER' } });
    for (const key of ['owner', 'other', 'approver']) {
      ids[key] = randomUUID();
      await prisma.user.create({ data: { id: ids[key], organizationId: ORG, email: `${key}-${tag}@b5f.test`, emailNormalized: `${key}-${tag}@b5f.test`, displayName: `B5F ${key}`, passwordHash: 'x', userRoles: { create: { roleId: recruiter.id } } } });
    }
    gradeId = (await prisma.masterDataValue.create({ data: { organizationId: ORG, category: 'grades', name: `B5F Grade ${tag}`, status: 'Active' } })).id;
    const vacancy = await prisma.vacancy.findFirstOrThrow({ where: { organizationId: ORG, status: 'Open' }, orderBy: { createdAt: 'asc' } });
    await prisma.vacancyRequest.update({ where: { id: vacancy.vacancyRequestId }, data: { gradeId } });
    ids.email = (await prisma.emailTemplate.create({ data: { organizationId: ORG, name: `B5F offer ${tag}`, subject: 'Your offer {{offerCode}}', bodyTemplate: 'Dear {{candidateName}}, your offer for {{positionTitle}} is ready.' } })).id;
    ids.emailOff = (await prisma.emailTemplate.create({ data: { organizationId: ORG, name: `B5F off ${tag}`, subject: 's', bodyTemplate: 'b', status: 'Inactive' } })).id;
    ids.wa = (await prisma.whatsAppTemplate.create({ data: { organizationId: ORG, name: `B5F wa ${tag}`, bodyTemplate: 'Hi {{candidateName}}, offer {{offerCode}}' } })).id;
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('item 2: create makes a Draft; submit moves it to Pending Approval (only from Draft/Changes Requested)', async () => {
    const app = await newApplication('Offer');
    const offerId = await create(app.id);
    const offer = await prisma.offer.findUniqueOrThrow({ where: { id: offerId }, include: { versions: { include: { approvals: true } } } });
    expect(offer.status).toBe('Draft');
    expect(offer.versions[0]).toMatchObject({ status: 'Draft', approvalStatus: 'Draft' });
    expect(offer.versions[0]!.approvals).toHaveLength(0);
    await offers.submitOffer(user(ids.owner!), offerId);
    const after = await prisma.offer.findUniqueOrThrow({ where: { id: offerId }, include: { versions: { include: { approvals: true } } } });
    expect(after.status).toBe('Pending Approval');
    expect(after.versions[0]).toMatchObject({ status: 'Pending Approval', approvalStatus: 'Pending' });
    expect(after.versions[0]!.approvals).toHaveLength(1);
    expect((await err(offers.submitOffer(user(ids.owner!), offerId))).code).toBe('OFFER_NOT_DRAFT');
    ids.offer = offerId; ids.app = app.id;
  });

  it('item 3: approver note (who, when, text) and the job grade reach the approver and the offer', async () => {
    const approval = await prisma.offerApproval.findFirstOrThrow({ where: { offerVersion: { offerId: ids.offer! } } });
    const inbox = await offers.getApprovalInbox(user(ids.approver!, ['OFFER_APPROVER']), { viewOfferPay: true });
    expect(inbox.find((i) => i.id === approval.id)?.grade).toEqual({ id: gradeId, name: `B5F Grade ${tag}` });
    await offers.submitDecision(user(ids.approver!, ['OFFER_APPROVER']), approval.id, { decision: 'Approve', note: 'Within band, approved for July start.' } as never);
    const detail = await offers.getOfferById(user(ids.owner!), ids.offer!, { viewOfferPay: true }) as unknown as { grade: unknown; currentVersion: { status: string; approverNote: { byUserId: string; byName: string; at: string; text: string } } };
    expect(detail.grade).toEqual({ id: gradeId, name: `B5F Grade ${tag}` });
    expect(detail.currentVersion.status).toBe('Approved');
    expect(detail.currentVersion.approverNote).toMatchObject({ byUserId: ids.approver, byName: 'B5F approver', text: 'Within band, approved for July start.' });
    expect(Date.parse(detail.currentVersion.approverNote.at)).not.toBeNaN();
  });

  it('item 4: send validates channel and template (exists, active, same channel); email uses the outbox', async () => {
    const send = (channel: string, templateId: string) => offers.sendOffer(user(ids.owner!), ids.offer!, { channel, templateId });
    expect((await err(send('sms', ids.email!))).code).toBe('OFFER_CHANNEL_INVALID');
    expect((await err(send('email', randomUUID()))).code).toBe('OFFER_TEMPLATE_INVALID');
    expect((await err(send('email', ids.emailOff!))).code).toBe('OFFER_TEMPLATE_INVALID');
    expect((await err(send('email', ids.wa!))).code).toBe('OFFER_TEMPLATE_CHANNEL_MISMATCH');
    expect((await err(send('whatsapp', ids.email!))).code).toBe('OFFER_TEMPLATE_CHANNEL_MISMATCH');
    queued.length = 0;
    const res = await send('email', ids.email!);
    expect(res).toMatchObject({ status: 'Sent', channel: 'email', queued: true });
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ template: 'notification', toEmail: expect.stringMatching(/^lina-/), payload: { message: expect.stringContaining('Dear Lina Haddad') } });
    const v = await prisma.offerVersion.findFirstOrThrow({ where: { offerId: ids.offer! } });
    expect(v).toMatchObject({ status: 'Sent', sentChannel: 'email', sentTemplateId: ids.email, sentById: ids.owner });
    expect((await err(send('email', ids.email!))).code).toBe('OFFER_NOT_APPROVED');
  });

  it('item 4: whatsapp returns the rendered text and a wa.me link (no provider)', async () => {
    const app = await newApplication('Offer');
    const offerId = await create(app.id);
    await offers.submitOffer(user(ids.owner!), offerId);
    const approval = await prisma.offerApproval.findFirstOrThrow({ where: { offerVersion: { offerId } } });
    await offers.submitDecision(user(ids.approver!, ['OFFER_APPROVER']), approval.id, { decision: 'Approve' } as never);
    queued.length = 0;
    const res = await offers.sendOffer(user(ids.owner!), offerId, { channel: 'whatsapp', templateId: ids.wa! }) as { waLink: string; message: string };
    expect(res.message).toMatch(/^Hi Lina Haddad, offer OFF-/);
    expect(res.waLink).toMatch(/^https:\/\/wa\.me\/971501112233\?text=Hi%20Lina/);
    expect(queued).toHaveLength(0);
  });

  it('item 6: GET /offers and GET /hiring filter by applicationId', async () => {
    const list = await offers.getOffers(user(ids.owner!), { applicationId: ids.app! }, { viewOfferPay: true });
    expect(list.map((o) => o.applicationId)).toEqual([ids.app]);
    expect(await offers.getOffers(user(ids.owner!), { applicationId: 'nope' }, { viewOfferPay: true })).toEqual([]);
    const hc = await prisma.hiringCase.create({ data: { organizationId: ORG, applicationId: ids.app!, offerId: ids.offer! } });
    const hiring = new HiringService(prisma as never, notifications as never, access as never);
    const cases = await hiring.listHiringCases(ORG, undefined, user(ids.owner!) as never, ids.app!) as Array<{ id: string }>;
    expect(cases.map((c) => c.id)).toEqual([hc.id]);
  });

  it('item 5: follow-up date is editable by the owner only', async () => {
    expect(await file.setFollowUp(user(ids.owner!), ids.app!, '2026-10-20')).toEqual({ id: ids.app, followUpDate: '2026-10-20' });
    expect((await err(file.setFollowUp(user(ids.other!), ids.app!, '2026-10-21'))).code).toBe('FOLLOW_UP_NOT_OWNER');
    expect((await err(file.setFollowUp(user(ids.owner!), ids.app!, '20/10/2026'))).status).toBe(400);
    expect(await file.setFollowUp(user(ids.owner!), ids.app!, null)).toEqual({ id: ids.app, followUpDate: null });
  });

  it('item 7: typed joining checks (verified, verifiedBy, verifiedAt, documentId) drive gate 4', async () => {
    const app = await newApplication('Pre-Hire');
    const doc = await prisma.candidateDocument.create({ data: { organizationId: ORG, candidateId: app.candidateId, documentType: 'Contract', fileName: 'contract.pdf', fileSize: 10, mimeType: 'application/pdf', storageKey: `k/${randomUUID()}`, uploadedById: ids.owner! } as never });
    expect((await file.listJoiningChecks(user(ids.owner!), app.id)).map((c) => [c.type, c.verified])).toEqual([['ID', false], ['CONTRACT', false], ['SCFHS_LICENCE', false]]);
    expect((await err(file.setJoiningCheck(user(ids.owner!), app.id, 'PASSPORT', { verified: true }))).code).toBe('JOINING_CHECK_TYPE_INVALID');
    expect((await err(file.setJoiningCheck(user(ids.owner!), app.id, 'CONTRACT', { verified: true, documentId: randomUUID() }))).status).toBe(400);
    const checks = await file.setJoiningCheck(user(ids.owner!), app.id, 'contract', { verified: true, documentId: doc.id });
    expect(checks.find((c) => c.type === 'CONTRACT')).toMatchObject({ verified: true, verifiedBy: { id: ids.owner, name: 'B5F owner' }, documentId: doc.id, verifiedAt: expect.any(String) });
    expect(await err(assertStageGate(prisma, app, 'Joined'))).toMatchObject({ status: 409, code: GATE_CODES.joining });
    await file.setJoiningCheck(user(ids.owner!), app.id, 'ID', { verified: true });
    await file.setJoiningCheck(user(ids.owner!), app.id, 'SCFHS_LICENCE', { verified: true });
    expect((await err(assertStageGate(prisma, app, 'Joined'))).status).toBe('ok');
    const un = await file.setJoiningCheck(user(ids.owner!), app.id, 'ID', { verified: false });
    expect(un.find((c) => c.type === 'ID')).toMatchObject({ verified: false, verifiedBy: null, verifiedAt: null });
    ids.docApp = app.id; ids.doc = doc.id;
  });

  it('item 8: documents list for the file card: metadata only, respects visibility', async () => {
    const docs = await file.listDocuments(user(ids.owner!), ids.docApp!);
    expect(docs).toEqual([{ id: ids.doc, type: 'Contract', name: 'contract.pdf', uploadedAt: expect.any(String), uploadedBy: { id: ids.owner, name: 'B5F owner' } }]);
    expect(Object.keys(docs[0]!).sort()).toEqual(['id', 'name', 'type', 'uploadedAt', 'uploadedBy']);
    visibleOnly.ids = [ids.app!];
    try {
      expect((await err(file.listDocuments(user(ids.other!), ids.docApp!))).status).toBe(404);
    } finally { visibleOnly.ids = null; }
  });
});
