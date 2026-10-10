/**
 * B7 against a real Postgres (migrated + seeded scratch DB). Skipped unless
 * B7_TEST_DATABASE_URL is set. NEVER point this at production.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { UserPermissionsService } from '../../common/user-permissions.service';
import { GradeBandsService } from '../grade-bands.service';
import { OfferDecisionService } from '../offer-decision.service';
import { ReassignService } from '../reassign.service';
import { OffersService } from '../../offers/offers.service';
import { OffersController } from '../../offers/offers.controller';

const url = process.env.B7_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

async function err(p: Promise<unknown>): Promise<{ status: number | string; body: Record<string, unknown> }> {
  try { await p; return { status: 'ok', body: {} }; } catch (e) {
    const body = ((e as { getResponse?: () => unknown }).getResponse?.() ?? {}) as Record<string, unknown>;
    return { status: (e as { getStatus?: () => number }).getStatus?.() ?? (e as Error).message, body };
  }
}

describe.skipIf(!url)('B7 grade bands, offer pay, manager decision, reassign (scratch Postgres)', () => {
  let prisma: PrismaService;
  let perms: UserPermissionsService;
  let bands: GradeBandsService;
  let decisions: OfferDecisionService;
  let reassign: ReassignService;
  const sent: Array<{ recipientUserId: string; type: string }> = [];
  const notifications = { create: async (n: { recipientUserId: string; type: string }) => { sent.push(n); } };
  const u: Record<string, string> = {};
  const roles: Record<string, string[]> = {};
  const user = (k: string) => ({ userId: u[k]!, organizationId: ORG, tokenVersion: 0, roleCodes: roles[k] ?? [] });
  let gradeId = ''; let branchId = ''; let jobId = ''; let ungradedJobId = '';

  async function mkUser(key: string, roleCode: string | null, extra: Record<string, unknown> = {}) {
    u[key] = randomUUID();
    roles[key] = roleCode ? [roleCode] : [];
    const role = roleCode ? await prisma.role.findFirstOrThrow({ where: { code: roleCode } }) : null;
    await prisma.user.create({ data: { id: u[key], organizationId: ORG, email: `${key}-${tag}@b7.test`, emailNormalized: `${key}-${tag}@b7.test`, displayName: `B7 ${key}`, passwordHash: 'x', ...(role ? { userRoles: { create: { roleId: role.id } } } : {}), ...extra } });
  }
  async function file(owner: string, vacancyId: string, stage = 'Offer') {
    const cand = await prisma.candidate.create({ data: { organizationId: ORG, candidateCode: `B7-${tag}-${randomUUID().slice(0, 6)}`, firstName: 'B7', lastName: 'Cand' } });
    return prisma.application.create({ data: { organizationId: ORG, applicationCode: `B7-${tag}-${cand.id.slice(0, 6)}`, vacancyId, candidateId: cand.id, stage, primaryRecruiterId: u[owner]! } });
  }
  async function pendingOffer(applicationId: string, base: number, allowance = 0, frequency = 'Monthly') {
    const offer = await prisma.offer.create({ data: { organizationId: ORG, applicationId, offerCode: `OFF-B7-${tag}-${randomUUID().slice(0, 6)}`, status: 'Pending Approval' } });
    const v = await prisma.offerVersion.create({ data: {
      offerId: offer.id, versionNumber: 1, status: 'Pending Approval', approvalStatus: 'Pending', monthlyPackage: base + allowance,
      components: { create: [{ type: 'Salary', name: 'Basic', amount: base, currency: 'AED', frequency }, ...(allowance ? [{ type: 'Allowance', name: 'Housing', amount: allowance, currency: 'AED', frequency: 'Monthly' }] : [])] },
      approvals: { create: [{ roleCode: 'OFFER_APPROVER', status: 'Pending' }] },
    } });
    await prisma.offer.update({ where: { id: offer.id }, data: { currentVersionId: v.id } });
    return { offerId: offer.id, versionId: v.id };
  }

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    perms = new UserPermissionsService(prisma);
    bands = new GradeBandsService(prisma, perms);
    decisions = new OfferDecisionService(prisma, perms, notifications as never);
    reassign = new ReassignService(prisma, notifications as never);
    await mkUser('mgr', 'HIRING_MANAGER');
    await mkUser('mgrNoPay', 'RECRUITER');
    await mkUser('owner', 'RECRUITER', { managerId: u.mgr });
    await mkUser('owner2', 'RECRUITER', { managerId: u.mgrNoPay });
    await mkUser('other', 'RECRUITER');
    await mkUser('admin', 'ADMINISTRATOR', { managerId: null });
    await prisma.user.update({ where: { id: u.owner! }, data: { managerId: u.mgr! } });
    await mkUser('target', 'RECRUITER');
    await mkUser('inactive', 'RECRUITER', { status: 'Inactive' });
    await mkUser('salaryOnly', null);
    const salaryRole = await prisma.role.create({ data: { code: `B7_SAL_${tag}`.toUpperCase(), name: `B7 salary ${tag}`, organizationId: ORG, permissions: { create: [{ permission: { connect: { code: 'VIEW_CURRENT_SALARY' } } }, { permission: { connect: { code: 'APPLICATION_VIEW' } } }] } } as never });
    await prisma.userRole.create({ data: { userId: u.salaryOnly!, roleId: salaryRole.id } });
    gradeId = (await prisma.masterDataValue.create({ data: { organizationId: ORG, category: 'grades', name: `B7 Grade ${tag}`, status: 'Active' } })).id;
    const jobs = await prisma.vacancy.findMany({ where: { organizationId: ORG }, orderBy: { createdAt: 'asc' }, take: 2, include: { vacancyRequest: true } });
    jobId = jobs[0]!.id; ungradedJobId = jobs[1]!.id; branchId = jobs[0]!.branchId;
    await prisma.vacancyRequest.update({ where: { id: jobs[0]!.vacancyRequestId }, data: { gradeId } });
    await prisma.vacancyRequest.update({ where: { id: jobs[1]!.vacancyRequestId }, data: { gradeId: null } });
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('bands: create, min<=max, no overlap per grade+site+currency (inclusive), deactivate-only', async () => {
    const band = await bands.create(user('admin'), { gradeId, branchId, currency: 'aed', minMonthlyBase: 10000, maxMonthlyBase: 15000 });
    expect(band).toMatchObject({ currency: 'AED', status: 'Active', minMonthlyBase: 10000, maxMonthlyBase: 15000, grade: { id: gradeId } });
    expect((await err(bands.create(user('admin'), { gradeId, branchId, currency: 'AED', minMonthlyBase: 9000, maxMonthlyBase: 8000 }))).body.code).toBe('GRADE_BAND_MIN_GT_MAX');
    expect((await err(bands.create(user('admin'), { gradeId, branchId, currency: 'AED', minMonthlyBase: 15000, maxMonthlyBase: 20000 }))).body.code).toBe('GRADE_BAND_OVERLAP');
    expect((await err(bands.create(user('admin'), { gradeId, branchId, currency: 'AED', minMonthlyBase: 5000, maxMonthlyBase: 10000 }))).body.code).toBe('GRADE_BAND_OVERLAP');
    const egp = await bands.create(user('admin'), { gradeId, branchId, currency: 'EGP', minMonthlyBase: 10000, maxMonthlyBase: 15000 });
    const above = await bands.create(user('admin'), { gradeId, branchId, currency: 'AED', minMonthlyBase: 15000.01, maxMonthlyBase: 20000 });
    expect((await err(bands.update(user('admin'), above.id, { minMonthlyBase: 14000 }))).body.code).toBe('GRADE_BAND_OVERLAP');
    const off = await bands.deactivate(user('admin'), above.id);
    expect(off.status).toBe('Inactive');
    expect(await prisma.gradeBand.count({ where: { id: above.id } })).toBe(1); // never deleted
    await bands.deactivate(user('admin'), egp.id);
    expect((await err(bands.update(user('admin'), band.id, { currency: 'EGP' }))).body.code).toBe('GRADE_BAND_IDENTITY_IMMUTABLE');
    // Employees see the grade, never the pay.
    const seen = (await bands.list(user('other'))).find((b) => b.id === band.id)!;
    expect(seen.grade.id).toBe(gradeId);
    expect('minMonthlyBase' in seen || 'maxMonthlyBase' in seen).toBe(false);
    expect((await bands.list(user('mgr'))).find((b) => b.id === band.id)?.maxMonthlyBase).toBe(15000);
    expect((await bands.list(user('admin'), true)).some((b) => b.id === above.id)).toBe(true);
  });

  it('offer pay needs OFFER_PAY_VIEW (omitted, not null); VIEW_CURRENT_SALARY alone does not show it', async () => {
    const app = await file('owner', jobId);
    const { offerId } = await pendingOffer(app.id, 12000, 3000);
    const access = { getApplicationVisibilityWhere: async () => ({ organizationId: ORG }) };
    const ctl = new OffersController(new OffersService(prisma, notifications as never, access as never), perms);
    const hidden = await ctl.getOfferById(user('salaryOnly'), offerId) as unknown as { currentVersion: Record<string, unknown> & { components: Array<Record<string, unknown>> } };
    expect('monthlyPackage' in hidden.currentVersion).toBe(false);
    expect('annualFixed' in hidden.currentVersion).toBe(false);
    expect(hidden.currentVersion.components.every((c) => !('amount' in c))).toBe(true);
    expect(await perms.hasPermission(u.salaryOnly!, ORG, 'VIEW_CURRENT_SALARY')).toBe(true);
    const shown = await ctl.getOfferById(user('mgr'), offerId) as unknown as { currentVersion: { monthlyPackage: number; components: Array<{ amount: number }> } };
    expect(shown.currentVersion.monthlyPackage).toBe(15000);
    expect(shown.currentVersion.components.map((c) => c.amount).sort()).toEqual([12000, 3000].sort());
    expect(await perms.hasPermission(u.mgr!, ORG, 'VIEW_CURRENT_SALARY')).toBe(false); // offer pay without current salary
    expect(await perms.hasPermission(u.admin!, ORG, 'OFFER_PAY_VIEW')).toBe(false);
  });

  it('only the owner\'s manager can decide (owner, other, admin get 403)', async () => {
    const app = await file('owner', jobId);
    const { offerId, versionId } = await pendingOffer(app.id, 12000);
    for (const k of ['owner', 'other', 'admin', 'mgrNoPay']) {
      expect((await err(decisions.decide(user(k), offerId, versionId, { decision: 'Approve' }))).body.code).toBe('OFFER_DECISION_NOT_MANAGER');
    }
  });

  it('inside band approves; allowances are ignored; history, audit and notification are written', async () => {
    const app = await file('owner', jobId);
    const { offerId, versionId } = await pendingOffer(app.id, 15000, 9000); // total 24k > max, base 15k = max
    sent.length = 0;
    const res = await decisions.decide(user('mgr'), offerId, versionId, { decision: 'Approve' });
    expect(res).toMatchObject({ decision: 'Approve', fromStatus: 'Pending Approval', toStatus: 'Approved' });
    expect((await prisma.offerVersion.findUniqueOrThrow({ where: { id: versionId } })).status).toBe('Approved');
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offerId } })).status).toBe('Approved');
    expect(await prisma.offerApproval.count({ where: { offerVersionId: versionId, status: 'Pending' } })).toBe(0);
    expect(await prisma.offerVersionDecision.count({ where: { offerVersionId: versionId, decidedById: u.mgr! } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityId: versionId, action: 'OFFER_MANAGER_DECISION' } })).toBe(1);
    expect(sent.some((n) => n.recipientUserId === u.owner && n.type === 'OfferManagerDecision')).toBe(true);
    expect((await err(decisions.decide(user('mgr'), offerId, versionId, { decision: 'Approve' }))).body.code).toBe('OFFER_NOT_PENDING_APPROVAL');
    // Annual salary is converted to monthly: 156k / 12 = 13k (inside).
    const app2 = await file('owner', jobId);
    const o2 = await pendingOffer(app2.id, 156000, 0, 'Annual');
    expect((await decisions.decide(user('mgr'), o2.offerId, o2.versionId, { decision: 'Approve' })).toStatus).toBe('Approved');
  });

  it('outside band: 409 OFFER_PAY_OUTSIDE_BAND with the band; pay figures only for OFFER_PAY_VIEW', async () => {
    const app = await file('owner', jobId);
    const { offerId, versionId } = await pendingOffer(app.id, 16000);
    const withPay = await err(decisions.decide(user('mgr'), offerId, versionId, { decision: 'Approve' }));
    expect(withPay.status).toBe(409);
    expect(withPay.body).toMatchObject({ code: 'OFFER_PAY_OUTSIDE_BAND', offeredMonthlyBase: 16000, band: { currency: 'AED', minMonthlyBase: 10000, maxMonthlyBase: 15000 } });
    expect((await prisma.offerVersion.findUniqueOrThrow({ where: { id: versionId } })).status).toBe('Pending Approval');
    const app2 = await file('owner2', jobId);
    const o2 = await pendingOffer(app2.id, 9000);
    const noPay = await err(decisions.decide(user('mgrNoPay'), o2.offerId, o2.versionId, { decision: 'Approve' }));
    expect(noPay.body.code).toBe('OFFER_PAY_OUTSIDE_BAND');
    expect(JSON.stringify(noPay.body)).not.toMatch(/9000|10000|15000|MonthlyBase/);
  });

  it('missing band: 409 GRADE_BAND_MISSING (ungraded job, or no band for the currency)', async () => {
    const app = await file('owner', ungradedJobId);
    const o = await pendingOffer(app.id, 12000);
    expect((await err(decisions.decide(user('mgr'), o.offerId, o.versionId, { decision: 'Approve' }))).body.code).toBe('GRADE_BAND_MISSING');
    const app2 = await file('owner', jobId);
    const o2 = await pendingOffer(app2.id, 12000);
    await prisma.offerComponent.updateMany({ where: { offerVersionId: o2.versionId }, data: { currency: 'EGP' } }); // EGP band was deactivated
    expect((await err(decisions.decide(user('mgr'), o2.offerId, o2.versionId, { decision: 'Approve' }))).body.code).toBe('GRADE_BAND_MISSING');
  });

  it('reject and request changes need a reason and use B5 states', async () => {
    const app = await file('owner', jobId);
    const o = await pendingOffer(app.id, 30000);
    expect((await err(decisions.decide(user('mgr'), o.offerId, o.versionId, { decision: 'RequestChanges' }))).body.code).toBe('DECISION_REASON_REQUIRED');
    expect((await decisions.decide(user('mgr'), o.offerId, o.versionId, { decision: 'RequestChanges', reason: 'Base above band' })).toStatus).toBe('Changes Requested');
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: o.offerId } })).status).toBe('Draft');
    const app2 = await file('owner', jobId);
    const o2 = await pendingOffer(app2.id, 12000);
    expect((await err(decisions.decide(user('mgr'), o2.offerId, o2.versionId, { decision: 'Reject' }))).body.code).toBe('DECISION_REASON_REQUIRED');
    const rej = await decisions.decide(user('mgr'), o2.offerId, o2.versionId, { decision: 'Reject', reason: 'Role on hold' });
    expect(rej.toStatus).toBe('Withdrawn');
    expect((await prisma.offerVersionDecision.findFirstOrThrow({ where: { offerVersionId: o2.versionId } })).reason).toBe('Role on hold');
    // Mustafa: Reject withdraws only that version; the offer goes back to Draft and the file stays in Offer.
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: o2.offerId } })).status).toBe('Draft');
    expect((await prisma.application.findUniqueOrThrow({ where: { id: app2.id } })).stage).toBe('Offer');
    const access = { getApplicationVisibilityWhere: async () => ({ organizationId: ORG }) };
    const svc = new OffersService(prisma, notifications as never, access as never);
    const v2 = await svc.createOfferRevision(user('owner') as never, o2.offerId, { components: [{ type: 'Salary', name: 'Basic', amount: 12000, currency: 'AED', frequency: 'Monthly', isTaxable: true }] } as never);
    expect(await prisma.offerVersion.findUniqueOrThrow({ where: { id: v2 } })).toMatchObject({ versionNumber: 2, status: 'Draft' });
  });

  it('reassign: admin 403, reason required, target eligible, manager only, closed files do not move', async () => {
    const open = await file('owner', jobId, 'Screening');
    const closed = await file('owner', jobId, 'Rejected');
    const body = { applicationIds: [open.id], toUserId: u.target!, reason: 'Owner on leave' };
    expect((await err(reassign.reassign(user('admin'), body))).status).toBe(403);
    expect((await err(reassign.reassign(user('mgr'), { ...body, reason: '  ' }))).body.code).toBe('REASSIGN_REASON_REQUIRED');
    expect((await err(reassign.reassign(user('mgr'), { ...body, toUserId: u.inactive! }))).body.code).toBe('REASSIGN_TARGET_INELIGIBLE');
    expect((await err(reassign.reassign(user('mgr'), { ...body, toUserId: u.admin! }))).body.code).toBe('REASSIGN_TARGET_INELIGIBLE');
    expect((await err(reassign.reassign(user('other'), body))).body.code).toBe('REASSIGN_NOT_MANAGER');
    expect((await err(reassign.reassign(user('mgrNoPay'), body))).body.code).toBe('REASSIGN_NOT_MANAGER');
    expect((await err(reassign.reassign(user('mgr'), { ...body, applicationIds: [open.id, closed.id] }))).body.code).toBe('REASSIGN_FILE_CLOSED');
    expect((await prisma.application.findUniqueOrThrow({ where: { id: open.id } })).primaryRecruiterId).toBe(u.owner); // atomic: nothing moved
  });

  it('bulk reassign of all open files: history, audit, notifications; owner is left with no open files', async () => {
    const closed = await file('owner', jobId, 'Joined');
    sent.length = 0;
    const res = await reassign.reassign(user('mgr'), { fromUserId: u.owner!, toUserId: u.target!, reason: 'Owner leaving' });
    expect(res.moved.length).toBeGreaterThan(3);
    const left = await prisma.application.count({ where: { primaryRecruiterId: u.owner!, stage: { notIn: ['Joined', 'Rejected', 'Withdrawn'] } } });
    expect(left).toBe(0); // TODO(B2): this is the count behind B2's deactivation 409; assert deactivation succeeds once #6 is on the base.
    expect((await prisma.application.findUniqueOrThrow({ where: { id: closed.id } })).primaryRecruiterId).toBe(u.owner); // closed file stays
    expect(await prisma.fileReassignment.count({ where: { batchId: res.batchId, fromUserId: u.owner!, toUserId: u.target!, reason: 'Owner leaving' } })).toBe(res.moved.length);
    expect(await prisma.auditLog.count({ where: { action: 'FILE_REASSIGN', entityId: { in: res.moved.map((m) => m.applicationId) } } })).toBe(res.moved.length);
    expect(sent.map((n) => n.recipientUserId).sort()).toEqual([u.owner!, u.target!].sort());
  });

  it('approver inbox decision runs the same band check (same codes; pay only for OFFER_PAY_VIEW)', async () => {
    const access = { getApplicationVisibilityWhere: async () => ({ organizationId: ORG }) };
    const inbox = new OffersService(prisma, notifications as never, access as never, undefined, perms);
    const approver = (k: string) => ({ ...user(k), roleCodes: [...(roles[k] ?? []), 'OFFER_APPROVER'] });
    const approvalOf = async (versionId: string) => (await prisma.offerApproval.findFirstOrThrow({ where: { offerVersionId: versionId } })).id;
    const out = await pendingOffer((await file('owner', jobId)).id, 16000);
    const withPay = await err(inbox.submitDecision(approver('mgr') as never, await approvalOf(out.versionId), { decision: 'Approve' } as never));
    expect(withPay.body).toMatchObject({ code: 'OFFER_PAY_OUTSIDE_BAND', offeredMonthlyBase: 16000, band: { minMonthlyBase: 10000, maxMonthlyBase: 15000 } });
    const noPay = await err(inbox.submitDecision(approver('other') as never, await approvalOf(out.versionId), { decision: 'Approve' } as never));
    expect(noPay.body.code).toBe('OFFER_PAY_OUTSIDE_BAND');
    expect(JSON.stringify(noPay.body)).not.toMatch(/16000|10000|15000|MonthlyBase/);
    expect((await prisma.offerApproval.findFirstOrThrow({ where: { offerVersionId: out.versionId } })).status).toBe('Pending');
    const missing = await pendingOffer((await file('owner', ungradedJobId)).id, 12000);
    expect((await err(inbox.submitDecision(approver('mgr') as never, await approvalOf(missing.versionId), { decision: 'Approve' } as never))).body.code).toBe('GRADE_BAND_MISSING');
    const inside = await pendingOffer((await file('owner', jobId)).id, 14000, 6000);
    await inbox.submitDecision(approver('mgr') as never, await approvalOf(inside.versionId), { decision: 'Approve' } as never);
    expect((await prisma.offerVersion.findUniqueOrThrow({ where: { id: inside.versionId } })).status).toBe('Approved');
    // A reject in the inbox has no band check.
    const rej = await pendingOffer((await file('owner', jobId)).id, 99000);
    await inbox.submitDecision(approver('other') as never, await approvalOf(rej.versionId), { decision: 'Reject', note: 'No' } as never);
  });

  it('owner who is also the manager stays blocked; the decision (and reassign) escalates to their own manager', async () => {
    await mkUser('top', 'HIRING_MANAGER');
    await mkUser('midMgr', 'TALENT_MANAGER', { managerId: u.top });
    await mkUser('rep', 'RECRUITER', { managerId: u.midMgr });
    const app = await file('rep', jobId);
    await prisma.application.update({ where: { id: app.id }, data: { taskOwnerId: u.midMgr! } }); // the manager co-owns the file
    const o = await pendingOffer(app.id, 12000);
    expect((await err(decisions.decide(user('midMgr'), o.offerId, o.versionId, { decision: 'Approve' }))).body.code).toBe('OFFER_DECISION_NOT_MANAGER');
    expect((await decisions.decide(user('top'), o.offerId, o.versionId, { decision: 'Approve' })).toStatus).toBe('Approved');
    const body = { applicationIds: [app.id], toUserId: u.target!, reason: 'Workload balancing' };
    expect((await err(reassign.reassign(user('midMgr'), body))).body.code).toBe('REASSIGN_NOT_MANAGER');
    expect((await reassign.reassign(user('top'), body)).moved).toHaveLength(1);
    // Without co-ownership the direct manager decides, and the grand-manager does not.
    const plain = await file('rep', jobId);
    const o2 = await pendingOffer(plain.id, 12000);
    expect((await err(decisions.decide(user('top'), o2.offerId, o2.versionId, { decision: 'Approve' }))).body.code).toBe('OFFER_DECISION_NOT_MANAGER');
    expect((await decisions.decide(user('midMgr'), o2.offerId, o2.versionId, { decision: 'Approve' })).toStatus).toBe('Approved');
  });

  it('M3: Approve with {basePay, allowances[], currency} stores the pay on the version and checks the band on basePay only', async () => {
    const app = await file('owner', jobId);
    const o = await pendingOffer(app.id, 99999); // stored figures are replaced by the manager's
    const noPerm = await err(decisions.decide(user('mgrNoPay'), o.offerId, o.versionId, { decision: 'Approve', basePay: 12000, allowances: [], currency: 'AED' }));
    expect(noPerm).toMatchObject({ status: 403, body: { code: 'OFFER_PAY_VIEW_REQUIRED' } });
    const outside = await err(decisions.decide(user('mgr'), o.offerId, o.versionId, { decision: 'Approve', basePay: 15001, allowances: [], currency: 'AED' }));
    expect(outside.body).toMatchObject({ code: 'OFFER_PAY_OUTSIDE_BAND', offeredMonthlyBase: 15001 });
    expect(await prisma.offerComponent.count({ where: { offerVersionId: o.versionId, amount: 15001 } })).toBe(0); // rolled back with the decision
    // allowances are excluded from the band check: 12000 base + 9000 allowances is still inside 10000-15000
    const ok = await decisions.decide(user('mgr'), o.offerId, o.versionId, { decision: 'Approve', basePay: 12000, allowances: [{ name: 'Housing', amount: 6000 }, { name: 'Transport', amount: 36000, frequency: 'Annual' }], currency: 'aed' });
    expect(ok.toStatus).toBe('Approved');
    const v = await prisma.offerVersion.findUniqueOrThrow({ where: { id: o.versionId }, include: { components: true } });
    expect(v.components.map((c) => [c.type, c.name, Number(c.amount), c.currency, c.frequency]).sort()).toEqual([
      ['Allowance', 'Housing', 6000, 'AED', 'Monthly'], ['Allowance', 'Transport', 36000, 'AED', 'Annual'], ['Salary', 'Base pay', 12000, 'AED', 'Monthly'],
    ].sort());
    expect(Number(v.monthlyPackage)).toBe(21000);
    // pay with a non-Approve decision is refused
    const o2 = await pendingOffer((await file('owner', jobId)).id, 12000);
    expect((await err(decisions.decide(user('mgr'), o2.offerId, o2.versionId, { decision: 'Reject', reason: 'No', basePay: 1, currency: 'AED' }))).status).toBe(400);
  });

  it('M3: GET /offers/:id carries branchId/siteId for band matching', async () => {
    const app = await file('owner', jobId);
    const { offerId } = await pendingOffer(app.id, 12000);
    const access = { getApplicationVisibilityWhere: async () => ({ organizationId: ORG }) };
    const ctl = new OffersController(new OffersService(prisma, notifications as never, access as never), perms);
    const job = await prisma.vacancy.findUniqueOrThrow({ where: { id: jobId } });
    expect(await ctl.getOfferById(user('mgr'), offerId)).toMatchObject({ branchId: job.branchId, siteId: job.branchId });
  });

  it('reassign reasons come from master data (reassign-reasons; Other needs a note); deactivate-only', async () => {
    const app = await file('owner', jobId, 'Screening');
    const body = { applicationIds: [app.id], toUserId: u.target! };
    expect((await err(reassign.reassign(user('mgr'), { ...body, reason: 'Because I said so' }))).body.code).toBe('REASON_NOT_IN_LIST');
    expect((await err(reassign.reassign(user('mgr'), { ...body, reason: 'Other' }))).body.code).toBe('REASON_REQUIRED');
    const res = await reassign.reassign(user('mgr'), { ...body, reason: 'Other', note: 'Candidate asked for a Arabic speaker' });
    expect(await prisma.fileReassignment.findFirstOrThrow({ where: { batchId: res.batchId } })).toMatchObject({ reason: 'Other: Candidate asked for a Arabic speaker' });
    const names = (await prisma.masterDataValue.findMany({ where: { organizationId: ORG, category: 'reassign-reasons' } })).map((v) => v.name);
    expect(names).toEqual(expect.arrayContaining(['Workload balancing', 'Owner on leave', 'Owner leaving', 'Specialist needed', 'Other']));
  });

  it('whole-job reassign stays files-only (v2 §7): the job owner never moves', async () => {
    const before = await prisma.vacancyAssignment.findMany({ where: { vacancyId: jobId, assignmentKind: 'PRIMARY', isActive: true }, select: { userId: true } });
    const jobBefore = await prisma.vacancy.findUniqueOrThrow({ where: { id: jobId } }) as unknown as Record<string, unknown>;
    await file('owner', jobId, 'Screening'); await file('owner', jobId, 'Interview');
    await reassign.reassign(user('mgr'), { fromUserId: u.owner!, toUserId: u.target!, reason: 'Owner leaving' });
    expect(await prisma.vacancyAssignment.findMany({ where: { vacancyId: jobId, assignmentKind: 'PRIMARY', isActive: true }, select: { userId: true } })).toEqual(before);
    const jobAfter = await prisma.vacancy.findUniqueOrThrow({ where: { id: jobId } }) as unknown as Record<string, unknown>;
    expect(jobAfter.primaryRecruiterId).toEqual(jobBefore.primaryRecruiterId); // undefined on this base, the B1 owner once #4 is under it
    expect(await prisma.application.count({ where: { vacancyId: jobId, primaryRecruiterId: u.owner!, stage: { notIn: ['Joined', 'Rejected', 'Withdrawn'] } } })).toBe(0);
  });

  it('seed demo: manager links, graded demo jobs and matching bands', async () => {
    const mona = await prisma.user.findFirstOrThrow({ where: { email: 'mona.manager@recruitflow.local' } });
    const hassan = await prisma.user.findFirstOrThrow({ where: { email: 'hassan.ali@recruitflow.local' } });
    expect(mona.managerId).toBe(hassan.id);
    expect(await prisma.user.count({ where: { organizationId: ORG, managerId: mona.id } })).toBeGreaterThan(0);
    const demoJobs = await prisma.vacancy.findMany({ where: { organizationId: ORG, vacancyCode: { in: ['VAC-2026-001', 'VAC-2026-002', 'VAC-2026-003', 'VAC-2026-004', 'VAC-2026-005', 'VAC-2026-006', 'VAC-2026-007', 'VAC-2026-008'] } }, include: { vacancyRequest: { include: { grade: true } } } });
    expect(demoJobs.length).toBeGreaterThan(0);
    // Other DB specs re-grade a couple of jobs in this shared scratch DB; the rest keep the seeded Grade 6.
    const g6 = demoJobs.filter((x) => x.vacancyRequest.grade?.name === 'Grade 6');
    expect(g6.length).toBeGreaterThanOrEqual(demoJobs.length - 3);
    for (const j of g6) {
      expect(await prisma.gradeBand.count({ where: { organizationId: ORG, gradeId: j.vacancyRequest.gradeId!, branchId: j.branchId, currency: 'AED', status: 'Active' } })).toBe(1);
    }
  });
});
