import { randomUUID } from 'node:crypto';
import type { AuthUser } from '@recruitflow/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { AdminOverrideService } from '../admin-override.service';
import { PipelineSettingsService } from '../../pipeline-settings/pipeline-settings.service';
import { IntegrationsService } from '../../integrations/integrations.service';
import { MasterDataService } from '../../master-data/master-data.service';
import { UsersController } from '../../users/users.controller';

const url = process.env.B9_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

describe.skipIf(!url)('B9 admin (scratch Postgres)', () => {
  let prisma: PrismaService;
  let overrides: AdminOverrideService;
  let jobId = '';
  const admin: AuthUser = { userId: '', organizationId: ORG, tokenVersion: 0, roleCodes: ['ADMINISTRATOR'] };
  const recruiter: AuthUser = { userId: randomUUID(), organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] };

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    admin.userId = (await prisma.user.findFirstOrThrow({ where: { organizationId: ORG, userRoles: { some: { role: { code: 'ADMINISTRATOR' } } } } })).id;
    overrides = new AdminOverrideService(prisma, { updateVacancyStatus: async (id: string, _org: string, status: string) => prisma.vacancy.update({ where: { id }, data: { status } }) } as never);
    jobId = (await prisma.vacancy.findFirstOrThrow({ where: { organizationId: ORG, status: 'Open' } })).id;
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('override: admin only, reason required, allowed actions only, audited', async () => {
    await expect(overrides.override(recruiter, { action: 'job.hold', entityId: jobId, reason: 'Budget freeze from finance' })).rejects.toMatchObject({ status: 403 });
    await expect(overrides.override(admin, { action: 'job.hold', entityId: jobId, reason: 'short' })).rejects.toMatchObject({ status: 400 });
    await expect(overrides.override(admin, { action: 'job.delete', entityId: jobId, reason: 'Budget freeze from finance' })).rejects.toMatchObject({ status: 400 });
    await expect(overrides.override(admin, { action: 'job.reopen', entityId: jobId, reason: `Budget back ${tag}` })).rejects.toMatchObject({ status: 409 });
    const res = await overrides.override(admin, { action: 'job.hold', entityId: jobId, reason: `Budget freeze ${tag}` });
    expect(res).toMatchObject({ from: 'Open', to: 'On Hold' });
    await overrides.override(admin, { action: 'job.reopen', entityId: jobId, reason: `Budget back ${tag}` });
    const audit = await prisma.auditLog.findMany({ where: { action: 'ADMIN_OVERRIDE', entityId: jobId, reason: { contains: tag } }, orderBy: { createdAt: 'asc' } });
    expect(audit.map((a) => [a.actorUserId, (a.afterData as { status: string }).status])).toEqual([[admin.userId, 'On Hold'], [admin.userId, 'Open']]);
  });

  it('override: close is covered and audited; reassign is a clear 400 until B7 is stacked', async () => {
    await expect(overrides.override(admin, { action: 'file.reassign', entityId: jobId, reason: `Owner left ${tag}` })).rejects.toMatchObject({ status: 400, response: { code: 'OVERRIDE_NOT_ALLOWED', message: expect.stringContaining('B7') } });
    const res = await overrides.override(admin, { action: 'job.close', entityId: jobId, reason: `Role cancelled ${tag}` });
    expect(res).toMatchObject({ from: 'Open', to: 'Closed' });
    await expect(overrides.override(admin, { action: 'job.close', entityId: jobId, reason: `Again closing ${tag}` })).rejects.toMatchObject({ status: 409 });
    expect(await prisma.auditLog.count({ where: { action: 'ADMIN_OVERRIDE', entityId: jobId, reason: `Role cancelled ${tag}` } })).toBe(1);
  });

  it('one pipeline template: list shows one; create/duplicate 409; default cannot be un-defaulted', async () => {
    const svc = new PipelineSettingsService(prisma);
    const list = await svc.listTemplates(ORG);
    expect(list).toHaveLength(1); // seeded
    expect(list[0]).toMatchObject({ name: 'Default pipeline', isDefault: true, stageCount: 6 });
    // a legacy extra template stays hidden
    await prisma.pipelineTemplate.create({ data: { organizationId: ORG, name: `Legacy ${tag}`, isDefault: false, status: 'Active' } });
    expect((await svc.listTemplates(ORG)).map((t) => t.id)).toEqual([list[0]!.id]);
    await expect(svc.createTemplate(ORG, { name: 'Second' } as never)).rejects.toMatchObject({ status: 409, response: { code: 'SINGLE_PIPELINE_TEMPLATE' } });
    await expect(svc.duplicateTemplate(ORG, list[0]!.id)).rejects.toMatchObject({ status: 409 });
    if (list[0]!.isDefault) await expect(svc.updateTemplate(ORG, list[0]!.id, { isDefault: false } as never)).rejects.toMatchObject({ status: 409 });
  });

  it('integrations: only careers publishing and mail; others hidden and 404', async () => {
    const svc = new IntegrationsService(prisma);
    const hidden = await prisma.integration.create({ data: { organizationId: ORG, name: `LinkedIn ${tag}`, provider: 'linkedin', category: 'Sourcing', status: 'Available' } });
    const list = await svc.listIntegrations(ORG);
    expect(list.map((i) => i.provider).sort()).toEqual(['careers_site', 'smtp']);
    await expect(svc.getIntegration(ORG, hidden.id)).rejects.toMatchObject({ status: 404 });
    await expect(svc.testIntegration(ORG, hidden.id)).rejects.toMatchObject({ status: 404 });
  });

  it('skill library admin reuses the B6 master-data category, deactivate-only', async () => {
    const md = new MasterDataService(prisma);
    const created = await prisma.masterDataValue.create({ data: { organizationId: ORG, category: 'skills', name: `B9 Skill ${tag}` } as never });
    const res = await md.deleteCatalogValue(ORG, 'skills', created.id);
    expect(res).toMatchObject({ deactivated: true, status: 'Inactive' });
    expect((await prisma.masterDataValue.findUnique({ where: { id: created.id } }))?.status).toBe('Inactive');
  });

  it('users are deactivate-only: DELETE /users/:id is 405', () => {
    const ctl = new UsersController({} as never, {} as never);
    expect(() => ctl.deleteUser()).toThrow(expect.objectContaining({ status: 405 }));
  });
});
