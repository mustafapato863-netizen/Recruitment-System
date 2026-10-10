import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { CandidateFillService } from '../candidate-fill.service';

const url = process.env.B6_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

describe.skipIf(!url)('POST /candidates/:id/fill-from-cv (scratch Postgres)', () => {
  let prisma: PrismaService;
  let svc: CandidateFillService;
  const visible = new Set<string>();
  let candId = ''; let noCv = '';
  const user = { userId: randomUUID(), organizationId: ORG, tokenVersion: 0, roleCodes: ['RECRUITER'] };
  const file = join(mkdtempSync(join(tmpdir(), 'fill-')), 'cv.pdf');

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    writeFileSync(file, 'pdf');
    const access = { getCandidateVisibilityWhere: async () => ({ id: { in: [...visible] } }) };
    const documents = { getFile: async () => ({ path: file, fileName: 'cv.pdf', mimeType: 'application/pdf' }) };
    const parser = { parseResume: async () => ({ firstName: 'Omar', lastName: 'Other', title: 'Charge Nurse', summary: '10 yrs ICU', languages: ['Arabic', 'English'], skills: ['ICU'] }) };
    svc = new CandidateFillService(prisma, access as never, documents as never, parser as never);
    candId = (await prisma.candidate.create({ data: { organizationId: ORG, candidateCode: `FC-${tag}`, firstName: 'Omar', lastName: 'Saleh' } })).id;
    noCv = (await prisma.candidate.create({ data: { organizationId: ORG, candidateCode: `FC0-${tag}`, firstName: 'No', lastName: 'Cv' } })).id;
    await prisma.candidateDocument.create({ data: { organizationId: ORG, candidateId: candId, documentType: 'CV', fileName: 'cv.pdf', mimeType: 'application/pdf', storageKey: `t/${tag}`, fileSize: 3 } as never });
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('out of scope → 404; no CV → 404', async () => {
    await expect(svc.fillFromCv(user, candId)).rejects.toMatchObject({ status: 404 });
    visible.add(noCv);
    await expect(svc.fillFromCv(user, noCv)).rejects.toMatchObject({ status: 404 });
  });

  it('fills empty fields only and reports conflicts; idempotent', async () => {
    visible.add(candId);
    const res = await svc.fillFromCv(user, candId);
    expect(res.filled.sort()).toEqual(['currentTitle', 'languages', 'skills', 'summary']);
    expect(res.conflicts).toEqual([{ field: 'lastName', existing: 'Saleh', incoming: 'Other' }]);
    const row = await prisma.candidate.findUniqueOrThrow({ where: { id: candId } });
    expect(row).toMatchObject({ lastName: 'Saleh', currentTitle: 'Charge Nurse', summary: '10 yrs ICU', languages: ['Arabic', 'English'] });
    const again = await svc.fillFromCv(user, candId);
    expect(again.filled).toEqual([]);
  });
});
