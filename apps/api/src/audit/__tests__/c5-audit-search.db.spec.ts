/** C5: GET /audit — admin-only, server-side filters and pagination. Scratch Postgres. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit.service';
import { AuditSearchController } from '../audit.controller';

const url = process.env.B3_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = `C5_${randomUUID().slice(0, 8)}`;

describe.skipIf(!url)('C5 audit search (scratch Postgres)', () => {
  let prisma: PrismaService;
  let svc: AuditService;
  let actor = '';
  const entityId = randomUUID();

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    svc = new AuditService(prisma);
    actor = (await prisma.user.findFirstOrThrow({ where: { organizationId: ORG }, orderBy: { createdAt: 'asc' } })).id;
    const rows = [
      { action: `${tag}_A`, createdAt: new Date('2026-03-01T10:00:00Z'), actorUserId: actor },
      { action: `${tag}_A`, createdAt: new Date('2026-03-02T10:00:00Z'), actorUserId: actor },
      { action: `${tag}_B`, createdAt: new Date('2026-03-02T22:30:00Z'), actorUserId: null }, // 2026-03-03 01:30 Cairo
      { action: `${tag}_B`, createdAt: new Date('2026-03-05T10:00:00Z'), actorUserId: actor },
    ];
    await prisma.auditLog.createMany({ data: rows.map((r) => ({ ...r, organizationId: ORG, entityType: tag, entityId, result: 'Success' })) });
  });
  afterAll(async () => { await prisma.auditLog.deleteMany({ where: { entityType: tag } }); await prisma?.$disconnect(); });

  it('filters by actor, action (comma list), entity, date range (Cairo days), and paginates', async () => {
    expect((await svc.search(ORG, { entity: tag })).total).toBe(4);
    expect((await svc.search(ORG, { entity: tag, actor })).total).toBe(3);
    expect((await svc.search(ORG, { entity: tag, action: `${tag}_B` })).total).toBe(2);
    expect((await svc.search(ORG, { entity: tag, action: `${tag}_A, ${tag}_B` })).total).toBe(4);
    expect((await svc.search(ORG, { entity: tag, entityId })).total).toBe(4);
    expect((await svc.search(ORG, { entity: tag, from: '2026-03-02', to: '2026-03-02' })).total).toBe(1); // 22:30Z on 03-02 is 03-03 in Cairo
    expect((await svc.search(ORG, { entity: tag, from: '2026-03-03', to: '2026-03-04' })).total).toBe(1);
    expect((await svc.search(ORG, { entity: tag, from: '2026-03-02T00:00:00Z' })).total).toBe(3);
    const p1 = await svc.search(ORG, { entity: tag, page: '1', pageSize: '3' });
    const p2 = await svc.search(ORG, { entity: tag, page: '2', pageSize: '3' });
    expect([p1.data.length, p2.data.length, p1.total]).toEqual([3, 1, 4]);
    expect(p1.data[0]!.createdAt).toBe('2026-03-05T10:00:00.000Z'); // newest first
    expect(p1.data.find((d) => d.actorUserId === actor)?.actorDisplayName).toBeTruthy();
  });

  it('validates input; admin-only at the controller', async () => {
    for (const bad of [{ pageSize: '500' }, { page: '0' }, { actor: 'nope' }, { from: 'x' }, { from: '2026-03-05', to: '2026-03-01' }]) {
      await expect(svc.search(ORG, bad)).rejects.toMatchObject({ status: 400 });
    }
    const ctl = new AuditSearchController(svc);
    expect(() => ctl.search({ userId: actor, organizationId: ORG, tokenVersion: 0, roleCodes: ['HR_MANAGER'] }, {})).toThrow(expect.objectContaining({ status: 403 }));
    expect((await ctl.search({ userId: actor, organizationId: ORG, tokenVersion: 0, roleCodes: ['ADMINISTRATOR'] }, { entity: tag })).total).toBe(4);
  });
});
