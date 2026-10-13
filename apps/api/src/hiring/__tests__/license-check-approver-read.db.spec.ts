/**
 * LICENSE_CHECK on the hiring routes + read-only file access for final-hire approvers
 * (no offer pay without OFFER_PAY_VIEW). Real Postgres; skipped unless B1_TEST_DATABASE_URL is set.
 * NEVER point this at production: it creates and deletes fixture rows.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '@recruitflow/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { privateVacancy } from '../../common/testing/private-vacancy';
import { PrismaService } from '../../database/prisma.service';
import { AccessControlService } from '../../access-control/access-control.service';
import { TenantScopedGuard } from '../../common/guards/tenant-scoped.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { UserPermissionsService } from '../../common/user-permissions.service';
import { ApplicationsController } from '../../applications/applications.controller';
import { DocumentsController } from '../../documents/documents.controller';
import { OffersService } from '../../offers/offers.service';
import { OffersController } from '../../offers/offers.controller';
import { HiringService, ensureLicenseRequirement } from '../hiring.service';
import { HiringController } from '../hiring.controller';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { AuditService } from '../../audit/audit.service';

const url = process.env.B1_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);
const MIGRATION = '20261011_license_specialist_license_check';
const migrationDir = join(__dirname, '../../../../../database/prisma/migrations', MIGRATION);

type Handler = (...args: never[]) => unknown;
type Ctor = { prototype: object; name: string };

describe.skipIf(!url)('LICENSE_CHECK on hiring + final-hire approver read (scratch Postgres)', () => {
  let prisma: PrismaService;
  let hiring: HiringService;
  let offersCtl: OffersController;
  const ids = {
    owner: randomUUID(), license: randomUUID(), approver: randomUUID(), payApprover: randomUUID(), payRole: randomUUID(),
    candidate: randomUUID(), application: randomUUID(), cv: randomUUID(),
    offer: randomUUID(), version: randomUUID(), hiringCase: randomUUID(), licenseReq: randomUUID(), docReq: randomUUID(),
  };
  const users = () => [ids.owner, ids.license, ids.approver, ids.payApprover];
  let vacancyId = '';
  const auth = (userId: string, roleCodes: string[]): AuthUser => ({ userId, organizationId: ORG, tokenVersion: 0, roleCodes });
  const lic = () => auth(ids.license, ['LICENSE_SPECIALIST']);
  const ap = () => auth(ids.approver, ['FINAL_HIRING_APPROVER']);

  async function call(user: AuthUser, cls: Ctor, method: string, params: Record<string, string> = {}): Promise<true> {
    const handler = (cls.prototype as Record<string, Handler>)[method];
    const req = { tenantId: ORG, user, params };
    const c = { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => handler, getClass: () => cls } as unknown as ExecutionContext;
    await new PermissionsGuard(new Reflector(), prisma).canActivate(c);
    await new TenantScopedGuard(new Reflector(), prisma).canActivate(c);
    return true;
  }
  const sqlStatements = (file: string) =>
    readFileSync(join(migrationDir, file), 'utf8').split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
      .split(';').map((s) => s.trim()).filter((s) => s && !/^(BEGIN|COMMIT)$/i.test(s));
  const grantCount = () => prisma.rolePermission.count({ where: { role: { code: 'LICENSE_SPECIALIST' }, permission: { code: 'LICENSE_CHECK' } } });

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    const access = new AccessControlService(prisma);
    const notifications = { create: async () => undefined, createForUser: async () => undefined } as unknown as NotificationsService;
    hiring = new HiringService(prisma, { log: async () => undefined } as unknown as AuditService, access);
    offersCtl = new OffersController(new OffersService(prisma, notifications, access), new UserPermissionsService(prisma));

    const roles = Object.fromEntries((await prisma.role.findMany({ where: { code: { in: ['RECRUITER', 'LICENSE_SPECIALIST', 'FINAL_HIRING_APPROVER'] } } })).map((r) => [r.code, r.id]));
    const payPerm = await prisma.permission.findUniqueOrThrow({ where: { code: 'OFFER_PAY_VIEW' } });
    await prisma.role.create({ data: { id: ids.payRole, code: `LC_PAY_${tag}`, name: 'LC pay', organizationId: ORG, permissions: { create: { permissionId: payPerm.id } } } });
    const mkUser = (id: string, name: string, roleIds: string[]) => prisma.user.create({
      data: { id, organizationId: ORG, email: `${name}-${tag}@lc.test`, emailNormalized: `${name}-${tag}@lc.test`, displayName: `LC ${name}`, passwordHash: 'x', status: 'Active', userRoles: { create: roleIds.map((roleId) => ({ roleId })) } },
    });
    await mkUser(ids.owner, 'owner', [roles.RECRUITER!]);
    await mkUser(ids.license, 'license', [roles.LICENSE_SPECIALIST!]);
    await mkUser(ids.approver, 'approver', [roles.FINAL_HIRING_APPROVER!]);
    await mkUser(ids.payApprover, 'pay-approver', [roles.FINAL_HIRING_APPROVER!, ids.payRole]);

    vacancyId = await privateVacancy(prisma, ORG, 'LC');
    await prisma.$transaction([
      prisma.vacancyAssignment.create({ data: { vacancyId, userId: ids.owner, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY', isActive: true } }),
      prisma.vacancyAssignment.create({ data: { vacancyId, userId: ids.license, roleCode: 'LICENSE_SPECIALIST', assignmentKind: 'SUPPORT', isActive: true } }),
      prisma.vacancy.update({ where: { id: vacancyId }, data: { primaryRecruiterId: ids.owner } }),
    ]);
    await prisma.candidate.create({ data: { id: ids.candidate, organizationId: ORG, candidateCode: `LC-${tag}`, firstName: 'LC', lastName: 'Cand', email: `cand-${tag}@lc.test` } });
    await prisma.application.create({ data: { id: ids.application, organizationId: ORG, applicationCode: `LC-${tag}`, vacancyId, candidateId: ids.candidate, stage: 'Offer', primaryRecruiterId: ids.owner } });
    await prisma.candidateDocument.create({ data: { id: ids.cv, organizationId: ORG, candidateId: ids.candidate, documentType: 'CV', fileName: 'cv.pdf', mimeType: 'application/pdf', fileSize: 1, storageKey: `lc/${tag}/cv`, storageProvider: 'local' } });
    await prisma.offer.create({ data: { id: ids.offer, organizationId: ORG, applicationId: ids.application, offerCode: `LC-${tag}`, status: 'Accepted', versions: { create: { id: ids.version, versionNumber: 1, approvalStatus: 'Approved', monthlyPackage: 12000, annualFixed: 144000, components: { create: { type: 'Salary', name: 'Base', amount: 10000, currency: 'AED', frequency: 'Monthly' } } } } } });
    await prisma.hiringCase.create({ data: {
      id: ids.hiringCase, organizationId: ORG, applicationId: ids.application, offerId: ids.offer, status: 'Pending Final Approval',
      approvals: { create: [
        { roleCode: 'FINAL_HIRING_APPROVER', approverUserId: ids.approver, status: 'Pending' },
        { roleCode: 'FINAL_HIRING_APPROVER', approverUserId: ids.payApprover, status: 'Pending' },
      ] },
      complianceRequirements: { create: [
        { id: ids.licenseReq, type: 'License', name: 'Nursing license' },
        { id: ids.docReq, type: 'Document', name: 'Passport' },
      ] },
    } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.hiringCase.deleteMany({ where: { id: ids.hiringCase } });
    await prisma.offer.deleteMany({ where: { id: ids.offer } });
    await prisma.candidateDocument.deleteMany({ where: { candidateId: ids.candidate } });
    await prisma.applicationStatusHistory.deleteMany({ where: { applicationId: ids.application } });
    await prisma.application.deleteMany({ where: { id: ids.application } });
    await prisma.candidate.deleteMany({ where: { id: ids.candidate } });
    await prisma.vacancyAssignment.deleteMany({ where: { vacancyId } });
    await prisma.vacancy.updateMany({ where: { id: vacancyId }, data: { primaryRecruiterId: null } });
    await prisma.vacancy.deleteMany({ where: { id: vacancyId } });
    await prisma.userRole.deleteMany({ where: { userId: { in: users() } } });
    await prisma.user.deleteMany({ where: { id: { in: users() } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: ids.payRole } });
    await prisma.role.deleteMany({ where: { id: ids.payRole } });
    await prisma.$disconnect();
  });

  describe('migration', () => {
    it('is idempotent, and the rollback removes the grant and its _prisma_migrations row', async () => {
      const row = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM "_prisma_migrations" WHERE migration_name = '${MIGRATION}'`);
      for (const s of sqlStatements('rollback.sql')) await prisma.$executeRawUnsafe(s);
      expect(await grantCount()).toBe(0);
      expect(await prisma.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '${MIGRATION}'`)).toHaveLength(0);
      for (const s of sqlStatements('rollback.sql')) await prisma.$executeRawUnsafe(s); // rollback twice: no-op
      for (let i = 0; i < 2; i++) for (const s of sqlStatements('migration.sql')) await prisma.$executeRawUnsafe(s);
      expect(await grantCount()).toBe(1);
      if (row[0]) {
        const r = row[0];
        await prisma.$executeRaw`INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
          VALUES (${r.id as string}, ${r.checksum as string}, ${r.finished_at as Date}, ${MIGRATION}, ${r.logs as string | null}, ${r.rolled_back_at as Date | null}, ${r.started_at as Date}, ${r.applied_steps_count as number})`;
      }
    });
  });

  describe('LICENSE_CHECK', () => {
    it('lists, reads and verifies license items on files it does not own', async () => {
      await expect(call(lic(), HiringController, 'listHiringCases')).resolves.toBe(true);
      expect((await hiring.listHiringCases(ORG, undefined, lic(), ids.application)).map((c) => c.id)).toEqual([ids.hiringCase]);
      await expect(call(lic(), HiringController, 'getHiringCase', { id: ids.hiringCase })).resolves.toBe(true);
      await expect(hiring.getHiringCase(ORG, ids.hiringCase, lic())).resolves.toMatchObject({ id: ids.hiringCase });
      await expect(call(lic(), HiringController, 'updateCompliance', { id: ids.hiringCase, reqId: ids.licenseReq })).resolves.toBe(true);
      await expect(hiring.updateCompliance(ORG, ids.hiringCase, ids.licenseReq, { status: 'Verified' } as never, lic())).resolves.toMatchObject({ status: 'Verified', verifiedById: ids.license });
    });

    it('cannot update non-license items, and gets nothing else on the file', async () => {
      await expect(hiring.updateCompliance(ORG, ids.hiringCase, ids.docReq, { status: 'Verified' } as never, lic())).rejects.toBeInstanceOf(ForbiddenException);
      await expect(call(lic(), HiringController, 'submitForFinalApproval', { id: ids.hiringCase })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(call(lic(), ApplicationsController, 'getApplication', { id: ids.application })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(call(lic(), OffersController, 'getOfferById', { id: ids.offer })).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('FINAL-2: LICENSE_CHECK-only payload', () => {
    const keys = ['branchName', 'candidateName', 'complianceRequirements', 'id', 'positionTitle', 'status'];
    it('list and detail return only id, status, candidate name, job, site and the licence items', async () => {
      const [listed] = await hiring.listHiringCases(ORG, undefined, lic(), ids.application);
      const detail = await hiring.getHiringCase(ORG, ids.hiringCase, lic());
      for (const c of [listed, detail] as Record<string, unknown>[]) {
        expect(Object.keys(c).sort()).toEqual(keys);
        expect(c).toMatchObject({ id: ids.hiringCase, candidateName: 'LC Cand' });
        const reqs = c.complianceRequirements as Array<{ id: string; type: string }>;
        expect(reqs.map((r) => r.id)).toEqual([ids.licenseReq]);
        expect(JSON.stringify(c)).not.toMatch(/@lc\.test|"application"|"vacancy"|"approvals"|Passport/);
      }
    });
    it('the file owner keeps the full payload; a final approver sees the approval journey only', async () => {
      const full = await hiring.getHiringCase(ORG, ids.hiringCase, auth(ids.owner, ['RECRUITER'])) as Record<string, unknown>;
      expect(full).toHaveProperty('application');
      expect((full.complianceRequirements as unknown[]).length).toBe(2);
      expect(JSON.stringify(full.application)).not.toMatch(/currentSalary|expectedSalary/);
      const journey = await hiring.getHiringCase(ORG, ids.hiringCase, ap()) as Record<string, unknown>;
      expect(journey).not.toHaveProperty('application');
      expect(journey).toHaveProperty('approvals');
      expect(JSON.stringify(journey)).not.toMatch(/currentSalary|expectedSalary|monthlyPackage/);
    });
  });

  describe('License item on new hiring cases', () => {
    it('createHiringCase adds one SCFHS licence item; ensureLicenseRequirement is idempotent', async () => {
      const [app2, offer2, cand2] = [randomUUID(), randomUUID(), randomUUID()];
      await prisma.candidate.create({ data: { id: cand2, organizationId: ORG, candidateCode: `LC2-${tag}`, firstName: 'LC', lastName: 'Two', email: `cand2-${tag}@lc.test` } });
      await prisma.application.create({ data: { id: app2, organizationId: ORG, applicationCode: `LC2-${tag}`, vacancyId, candidateId: cand2, stage: 'Offer', primaryRecruiterId: ids.owner } });
      await prisma.offer.create({ data: { id: offer2, organizationId: ORG, applicationId: app2, offerCode: `LC2-${tag}`, status: 'Accepted' } });
      try {
        const created = await hiring.createHiringCase(ORG, { offerId: offer2 } as never, auth(ids.owner, ['RECRUITER'])) as { id: string };
        await ensureLicenseRequirement(prisma, created.id);
        const items = await prisma.complianceRequirement.findMany({ where: { hiringCaseId: created.id }, orderBy: { name: 'asc' } });
        expect(items.filter((i) => i.type === 'License').map((i) => i.name)).toEqual(['SCFHS licence']);
        expect(items).toHaveLength(3);
      } finally {
        await prisma.hiringCase.deleteMany({ where: { applicationId: app2 } });
        await prisma.offer.deleteMany({ where: { id: offer2 } });
        await prisma.applicationStatusHistory.deleteMany({ where: { applicationId: app2 } });
        await prisma.application.deleteMany({ where: { id: app2 } });
        await prisma.candidate.deleteMany({ where: { id: cand2 } });
      }
    });
  });

  describe('final-hire approver (read-only)', () => {
    it('reads the application file and its CV', async () => {
      await expect(call(ap(), ApplicationsController, 'getApplication', { id: ids.application })).resolves.toBe(true);
      await expect(call(ap(), DocumentsController, 'downloadFile', { id: ids.cv })).resolves.toBe(true);
      await expect(call(ap(), OffersController, 'getOfferById', { id: ids.offer })).resolves.toBe(true);
    });

    it('sees no offer pay without OFFER_PAY_VIEW; sees it with it', async () => {
      const plain = JSON.stringify(await offersCtl.getOfferById(ap(), ids.offer));
      expect(plain).not.toMatch(/monthlyPackage|annualFixed|"amount"/);
      const paid = JSON.stringify(await offersCtl.getOfferById(auth(ids.payApprover, ['FINAL_HIRING_APPROVER']), ids.offer));
      expect(paid).toMatch(/monthlyPackage/);
      expect(paid).toMatch(/"amount"/);
    });

    it('gets no writes and no compliance updates', async () => {
      await expect(call(ap(), HiringController, 'updateCompliance', { id: ids.hiringCase, reqId: ids.licenseReq })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(call(ap(), ApplicationsController, 'createNote', { id: ids.application })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(call(ap(), HiringController, 'listHiringCases')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(hiring.updateCompliance(ORG, ids.hiringCase, ids.docReq, { status: 'Verified' } as never, ap())).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
