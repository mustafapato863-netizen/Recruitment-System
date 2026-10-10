/**
 * B6 against a real Postgres (migrated + seeded scratch DB). Skipped unless
 * B6_TEST_DATABASE_URL is set. NEVER point this at production.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../database/prisma.service';
import { UserPermissionsService } from '../../common/user-permissions.service';
import { MatchingService } from '../matching.service';
import { ImportService } from '../../import/import.service';
import { MasterDataService } from '../../master-data/master-data.service';
import { InterviewsService } from '../../interviews/interviews.service';
import { DocumentsService } from '../../documents/documents.service';
import { linkCandidateSkills } from '../skill-links';
import { normalizePhoneKey, repairContactKeys } from '../../candidates/contact-keys';

const url = process.env.B6_TEST_DATABASE_URL;
const ORG = '10000000-0000-4000-8000-000000000001';
const tag = randomUUID().slice(0, 8);

async function statusOf(p: Promise<unknown>): Promise<string> {
  try { await p; return 'ok'; } catch (e) {
    const r = (e as { getResponse?: () => unknown }).getResponse?.() as { code?: string } | undefined;
    return `${(e as { getStatus?: () => number }).getStatus?.() ?? 'err'}${r?.code ? ` ${r.code}` : ''}`;
  }
}
const keysDeep = (v: unknown, acc: string[] = []): string[] => {
  if (Array.isArray(v)) v.forEach((x) => keysDeep(x, acc));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { acc.push(k); keysDeep(x, acc); }
  return acc;
};
const numbersDeep = (v: unknown, acc: number[] = []): number[] => {
  if (typeof v === 'number') acc.push(v);
  else if (Array.isArray(v)) v.forEach((x) => numbersDeep(x, acc));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => numbersDeep(x, acc));
  return acc;
};

describe.skipIf(!url)('B6 suggest, compare, evidence, duplicates (scratch Postgres)', () => {
  let prisma: PrismaService;
  let matching: MatchingService;
  let imports: ImportService;
  const ids: Record<string, string> = {};
  const user = (userId: string, roleCodes: string[] = []) => ({ userId, organizationId: ORG, tokenVersion: 0, roleCodes });
  const skill: Record<string, string> = {};

  async function cand(code: string, extra: Record<string, unknown> = {}) {
    const c = await prisma.candidate.create({ data: { organizationId: ORG, candidateCode: `B6-${tag}-${code}`, firstName: 'B6', lastName: code, ...extra } });
    return c.id;
  }

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url } } });
    matching = new MatchingService(prisma, new UserPermissionsService(prisma));
    imports = new ImportService(prisma);
    for (const name of ['ICU', 'BLS', 'Triage']) {
      skill[name] = (await prisma.masterDataValue.upsert({
        where: { organizationId_category_name: { organizationId: ORG, category: 'skills', name: `${name} ${tag}` } },
        create: { organizationId: ORG, category: 'skills', name: `${name} ${tag}`, status: 'Active' }, update: {},
      })).id;
    }
    for (const key of ['mgr', 'owner', 'other']) {
      ids[key] = randomUUID();
      await prisma.user.create({ data: { id: ids[key], organizationId: ORG, email: `${key}-${tag}@b6.test`, emailNormalized: `${key}-${tag}@b6.test`, displayName: `B6 ${key}`, passwordHash: 'x', ...(key === 'owner' ? { managerId: ids.mgr } : {}) } });
    }
    // Scratch DB: reuse a seeded job and give it this run's required skills.
    const tpl = await prisma.vacancy.findFirstOrThrow({ where: { organizationId: ORG }, orderBy: { createdAt: 'asc' } });
    const vac = await prisma.vacancy.update({ where: { id: tpl.id }, data: { requiredSkills: [` iCu   ${tag} `, `BLS ${tag}`, `Triage ${tag}`, 'Not In Library'] } });
    ids.vac = vac.id;
    await prisma.vacancyAssignment.create({ data: { vacancyId: vac.id, userId: ids.owner!, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY' } });

    // A: 2 skills with evidence; B: 3 skills, 1 evidenced; C: 2 skills no evidence; D: 1 evidenced (older)
    ids.A = await cand('A'); ids.B = await cand('B'); ids.C = await cand('C'); ids.D = await cand('D');
    ids.onJob = await cand('ONJOB'); ids.archived = await cand('ARCH', { status: 'Archived' }); ids.nomatch = await cand('NONE');
    const ev = (c: string, s: string, snippet = 'quote') => matching.addEvidence(ORG, c, { skillId: skill[s]!, snippet }, ids.owner!);
    const link = (c: string, s: string) => prisma.candidateSkill.create({ data: { organizationId: ORG, candidateId: c, skillId: skill[s]! } });
    await ev(ids.D, 'ICU', 'D old');
    await new Promise((r) => setTimeout(r, 20));
    await ev(ids.A, 'ICU', 'Five years ICU'); await ev(ids.A, 'BLS', 'BLS card 2025');
    await ev(ids.B, 'ICU'); await link(ids.B, 'BLS'); await link(ids.B, 'Triage');
    await link(ids.C, 'ICU'); await link(ids.C, 'BLS');
    for (const c of [ids.onJob, ids.archived]) { await ev(c!, 'ICU'); await ev(c!, 'BLS'); await ev(c!, 'Triage'); }
    await prisma.application.create({ data: { organizationId: ORG, applicationCode: `B6-${tag}`, vacancyId: vac.id, candidateId: ids.onJob!, stage: 'Applied' } });
  });
  afterAll(async () => { await prisma?.$disconnect(); });

  it('orders by evidenced required skills, then held skills, then recency; no % or score anywhere', async () => {
    const res = await matching.suggestions(user(ids.owner!), ids.vac!);
    const order = res.suggestions.map((s) => s.candidate.id).filter((id) => [ids.A, ids.B, ids.C, ids.D].includes(id));
    expect(order).toEqual([ids.A, ids.B, ids.D, ids.C]);
    expect(res.unmappedRequiredSkills).toEqual(['Not In Library']);
    expect(res.requiredSkills.map((s) => s.id)).toEqual([skill.ICU, skill.BLS, skill.Triage]);
    const keys = keysDeep(res).join(' ');
    expect(keys).not.toMatch(/score|percent|pct|match(Rate|Ratio)|rank|fit/i);
    expect(JSON.stringify(res)).not.toMatch(/\d+(\.\d+)?\s*%/);
    expect(numbersDeep(res)).toEqual([]);
  });

  it('includes evidence per matched skill and lists missing skills', async () => {
    const res = await matching.suggestions(user(ids.owner!), ids.vac!);
    const a = res.suggestions.find((s) => s.candidate.id === ids.A)!;
    expect(a.matchedSkills.map((m) => [m.skill.id, m.hasEvidence])).toEqual([[skill.ICU, true], [skill.BLS, true]]);
    expect(a.matchedSkills[0]!.evidence[0]).toMatchObject({ sourceType: 'MANUAL', snippet: 'Five years ICU', addedBy: { id: ids.owner } });
    expect(a.missingSkills.map((s) => s.id)).toEqual([skill.Triage]);
    const c = res.suggestions.find((s) => s.candidate.id === ids.C)!;
    expect(c.matchedSkills.every((m) => !m.hasEvidence && m.evidence.length === 0)).toBe(true);
  });

  it('excludes candidates already on the job, archived ones and ones holding no required skill', async () => {
    const got = (await matching.suggestions(user(ids.owner!), ids.vac!)).suggestions.map((s) => s.candidate.id);
    expect(got).not.toContain(ids.onJob);
    expect(got).not.toContain(ids.archived);
    expect(got).not.toContain(ids.nomatch);
  });

  it('403 for users who are not owner, manager, admin or VACANCY_MANAGE', async () => {
    expect(await statusOf(matching.suggestions(user(ids.other!), ids.vac!))).toBe('403 NOT_JOB_OWNER');
    expect(await statusOf(matching.compare(user(ids.other!), ids.vac!, [ids.A!, ids.B!]))).toBe('403 NOT_JOB_OWNER');
    expect(await statusOf(matching.suggestions(user(ids.mgr!), ids.vac!))).toBe('ok');
    expect(await statusOf(matching.suggestions(user(ids.other!, ['ADMINISTRATOR']), ids.vac!))).toBe('ok');
  });

  it('compare: 2 to 4 candidates side by side by required skill, with evidence, no %', async () => {
    const res = await matching.compare(user(ids.owner!), ids.vac!, [ids.A!, ids.B!, ids.C!]);
    expect(res.candidates.map((c) => c.id)).toEqual([ids.A, ids.B, ids.C]);
    const icu = res.rows.find((r) => r.skill.id === skill.ICU)!;
    expect(icu.cells.map((c) => c.status)).toEqual(['evidence', 'evidence', 'no-evidence']);
    const triage = res.rows.find((r) => r.skill.id === skill.Triage)!;
    expect(triage.cells.map((c) => c.status)).toEqual(['missing', 'no-evidence', 'missing']);
    expect(icu.cells[0]!.evidence[0]!.snippet).toBe('Five years ICU');
    expect(numbersDeep(res)).toEqual([]);
    expect(await statusOf(matching.compare(user(ids.owner!), ids.vac!, [ids.A!]))).toBe('400 COMPARE_COUNT');
    expect(await statusOf(matching.compare(user(ids.owner!), ids.vac!, [ids.A!, ids.B!, ids.C!, ids.D!, ids.nomatch!]))).toBe('400 COMPARE_COUNT');
    expect(await statusOf(matching.compare(user(ids.owner!), ids.vac!, [ids.A!, ids.archived!]))).toBe('404 COMPARE_CANDIDATE_NOT_FOUND');
  });

  it('evidence: manual needs a snippet; deactivated skills are rejected; derive finds CV text', async () => {
    expect(await statusOf(matching.addEvidence(ORG, ids.A!, { skillId: skill.Triage! }, ids.owner!))).toBe('400 EVIDENCE_SNIPPET_REQUIRED');
    const old = await prisma.masterDataValue.create({ data: { organizationId: ORG, category: 'skills', name: `Old ${tag}`, status: 'Inactive' } });
    expect(await statusOf(matching.addEvidence(ORG, ids.A!, { skillId: old.id, snippet: 'x' }, ids.owner!))).toBe('400 SKILL_INACTIVE');
    const doc = await prisma.candidateDocument.findFirst({ where: { organizationId: ORG } });
    if (doc) {
      await prisma.candidateDocument.update({ where: { id: doc.id }, data: { extractionText: `Experienced in triage ${tag} and BLS ${tag}.`, deletedAt: null } });
      const out = await matching.deriveEvidence(ORG, doc.candidateId, ids.owner!);
      expect(out.found.filter((f) => f.sourceType === 'CV_TEXT' && Object.values(skill).includes(f.skillId)).map((f) => f.skillId).sort()).toEqual([skill.BLS, skill.Triage].sort());
      const again = await matching.deriveEvidence(ORG, doc.candidateId, ids.owner!);
      const count = await prisma.candidateSkillEvidence.count({ where: { sourceRef: doc.id, candidateSkill: { skillId: { in: Object.values(skill) } } } });
      expect(again.found.length).toBe(out.found.length);
      expect(count).toBe(2);
    }
  });

  it('duplicate check by email and by phone, normalized; boot repair fills keys for raw writes', async () => {
    const id = await cand('DUP', { email: `  Mixed.Case-${tag}@Example.COM `, phone: '050 777 1234' });
    expect((await prisma.candidate.findUniqueOrThrow({ where: { id } })).phoneNormalized).toBeNull();
    await repairContactKeys(prisma, '966');
    const row = await prisma.candidate.findUniqueOrThrow({ where: { id } });
    expect(row.emailNormalized).toBe(`mixed.case-${tag}@example.com`);
    expect(row.phoneNormalized).toBe('+966507771234');
    const byEmail = await matching.duplicateCheck(ORG, { email: `MIXED.case-${tag}@example.com` });
    expect(byEmail.matches.map((m) => [m.candidateId, m.matchedBy])).toEqual([[id, ['email']]]);
    const byPhone = await matching.duplicateCheck(ORG, { phone: '+966 50 777 1234' });
    expect(byPhone.matches.find((m) => m.candidateId === id)?.matchedBy).toEqual(['phone']);
    expect((await matching.duplicateCheck(ORG, { phone: '00966507771234' })).isDuplicate).toBe(true);
    expect(await statusOf(matching.duplicateCheck(ORG, {}))).toBe('400 CONTACT_REQUIRED');
  });

  it('SQL rf_normalize_phone and TS normalizePhoneKey agree for every cc (incl. none)', async () => {
    const corpus = ['0501234567', '+966 50 123 4567', '00966-501-234-567', '501234567', '966501234567', '(050) 123-4567', '+20 100 123 4567', '01001234567', '1234', '', '  ', '+1 (415) 555-0100', '0044 20 7946 0958', '1234567890123456'];
    for (const cc of ['966', '20', '1', null]) {
      const rows = await prisma.$queryRawUnsafe<Array<{ raw: string; k: string | null }>>(
        `SELECT raw, rf_normalize_phone(raw, $1) k FROM unnest($2::text[]) raw`, cc, corpus);
      for (const r of rows) expect([cc, r.raw, r.k]).toEqual([cc, r.raw, normalizePhoneKey(r.raw, cc)]);
    }
  });

  it('typed profile skills are never evidence', async () => {
    const id = await cand('TYPED', { skills: [`ICU ${tag}`, `BLS ${tag}`] });
    await linkCandidateSkills(prisma, ORG, id, [`ICU ${tag}`, `BLS ${tag}`]);
    const res = await matching.suggestions(user(ids.owner!), ids.vac!);
    const typed = res.suggestions.find((s) => s.candidate.id === id)!;
    expect(typed.matchedSkills.map((m) => [m.hasEvidence, m.evidence.length])).toEqual([[false, 0], [false, 0]]);
    expect(await prisma.candidateSkillEvidence.count({ where: { candidateSkill: { candidateId: id } } })).toBe(0);
  });

  it('saving a job never reactivates a deactivated skill; it comes back under unmappedRequiredSkills', async () => {
    const md = new MasterDataService(prisma);
    const dead = await prisma.masterDataValue.create({ data: { organizationId: ORG, category: 'skills', name: `Retired ${tag}`, status: 'Active' } });
    await md.deleteCatalogValue(ORG, 'skills', dead.id);
    const names = await prisma.$transaction((tx) => md.syncSkillsInTransaction(tx, ORG, [`retired  ${tag}`]));
    expect(names).toEqual([`Retired ${tag}`]);
    expect((await prisma.masterDataValue.findUniqueOrThrow({ where: { id: dead.id } })).status).toBe('Inactive');
    const v = await prisma.vacancy.findUniqueOrThrow({ where: { id: ids.vac! } });
    await prisma.vacancy.update({ where: { id: ids.vac! }, data: { requiredSkills: [...v.requiredSkills, `Retired ${tag}`] } });
    const res = await matching.suggestions(user(ids.owner!), ids.vac!);
    expect(res.unmappedRequiredSkills).toContain(`Retired ${tag}`);
    expect(res.requiredSkills.map((r) => r.id)).not.toContain(dead.id);
    await prisma.vacancy.update({ where: { id: ids.vac! }, data: { requiredSkills: v.requiredSkills } });
  });

  it('auto-derives evidence after CV text is stored and after a scorecard is submitted (idempotent)', async () => {
    const pending: Promise<void>[] = [];
    const orig = matching.deriveEvidenceInBackground.bind(matching);
    matching.deriveEvidenceInBackground = (...a: Parameters<typeof orig>) => { const p = orig(...a); pending.push(p); return p; };
    const audit = { log: async () => undefined };
    const docs = new DocumentsService(prisma, audit as never, {} as never, {} as never, undefined, matching);
    const cid = await cand('AUTO');
    for (let i = 0; i < 2; i++) {
      await docs.createDocument(ORG, ids.owner!, { candidateId: cid, documentType: 'CV', fileName: 'cv.pdf', mimeType: 'application/pdf', fileSize: 10, extractionText: `Charge nurse, triage ${tag} lead.` } as never);
    }
    await Promise.all(pending);
    const cv = await prisma.candidateSkillEvidence.findMany({ where: { candidateSkill: { candidateId: cid, skillId: skill.Triage! }, sourceType: 'CV_TEXT' } });
    expect(cv).toHaveLength(2); // one per document, re-runs add nothing
    await matching.deriveEvidence(ORG, cid, null);
    expect(await prisma.candidateSkillEvidence.count({ where: { candidateSkill: { candidateId: cid, skillId: skill.Triage! }, sourceType: 'CV_TEXT' } })).toBe(2);

    const app = await prisma.application.create({ data: { organizationId: ORG, applicationCode: `B6S-${tag}`, vacancyId: (await prisma.vacancy.findFirstOrThrow({ where: { organizationId: ORG, id: { not: ids.vac! } } })).id, candidateId: cid, stage: 'Interview' } });
    const iv = await prisma.interview.create({ data: { organizationId: ORG, interviewCode: `B6I-${tag}`, title: 'B6 interview', applicationId: app.id, interviewType: 'Technical', scheduledStart: new Date('2031-01-01T08:00:00Z'), scheduledEnd: new Date('2031-01-01T09:00:00Z'), status: 'Scheduled', attendees: { create: { userId: ids.owner! } } } as never });
    const access = { getApplicationVisibilityWhere: async () => ({ organizationId: ORG }), getInterviewVisibilityWhere: async () => ({ organizationId: ORG }) };
    const interviews = new InterviewsService(prisma, { create: async () => undefined } as never, access as never, matching);
    pending.length = 0;
    await interviews.submitScorecard(ORG, iv.id, ids.owner!, { overallRating: 4, recommendation: 'Hire', notes: `Strong ICU ${tag} background.` } as never);
    await Promise.all(pending);
    const sc = await prisma.candidateSkillEvidence.findMany({ where: { candidateSkill: { candidateId: cid, skillId: skill.ICU! }, sourceType: 'SCORECARD' } });
    expect(sc).toHaveLength(1);
  });

  it('import links to the existing person, fills only empty fields, reports conflicts, never creates a duplicate', async () => {
    const id = await cand('IMP', { email: `imp-${tag}@b6.test`, phone: null, currentTitle: 'Staff Nurse', location: null, skills: [] });
    await repairContactKeys(prisma, '966'); // raw test write; the API's boot repair does this
    const { jobId } = await imports.upload(ORG, ids.owner!, { fileName: 'b6.xlsx', rows: [
      { firstName: 'B6', lastName: 'IMP', email: ` IMP-${tag}@B6.TEST`, phone: '0508889999', currentTitle: 'Charge Nurse', location: 'Riyadh', skills: [`ICU ${tag}`] },
      { firstName: 'New', lastName: 'Person', email: `new-${tag}@b6.test` },
    ] } as never);
    const rows = await prisma.candidateImportRow.findMany({ where: { jobId }, orderBy: { rowNumber: 'asc' } });
    expect(rows[0]!.result).toBe('Duplicate');
    await imports.saveDecision(ORG, jobId, rows[0]!.id, { decision: 'Update' } as never);
    const before = await prisma.candidate.count({ where: { organizationId: ORG } });
    const res = await imports.confirmJob(ORG, jobId, ids.owner!);
    expect(await prisma.candidate.count({ where: { organizationId: ORG } })).toBe(before + 1);
    const linked = res.duplicateReport.find((r) => r.rowId === rows[0]!.id)!;
    expect(linked).toMatchObject({ action: 'linked', candidateId: id, matchedBy: ['email'] });
    expect(linked.filled.sort()).toEqual(['location', 'phone', 'skills']);
    expect(linked.conflicts).toEqual([{ field: 'currentTitle', existing: 'Staff Nurse', incoming: 'Charge Nurse' }]);
    const after = await prisma.candidate.findUniqueOrThrow({ where: { id } });
    expect(after.currentTitle).toBe('Staff Nurse');
    expect(after.location).toBe('Riyadh');
    expect(after.phoneNormalized).toBe('+966508889999');
    const ev = await prisma.candidateSkillEvidence.findMany({ where: { candidateSkill: { candidateId: id } } });
    expect(ev.map((e) => e.sourceType)).toEqual(['IMPORT']);
    expect(res.duplicateReport.find((r) => r.rowId === rows[1]!.id)?.action).toBe('created');
  });

  it('E3: linking fills empty fields from the parsed CV (summary, certifications, languages, title...), never overwrites; conflicts listed', async () => {
    const id = await cand('CVF', { email: `cvf-${tag}@b6.test`, phone: null, currentTitle: null, currentCompany: 'Old Co', summary: null, certifications: [], languages: ['Arabic'], skills: [] });
    await repairContactKeys(prisma, '966');
    const { jobId } = await imports.upload(ORG, ids.owner!, { fileName: 'cv.pdf', rows: [
      { firstName: 'B6', lastName: 'CVF', email: `cvf-${tag}@b6.test`, currentTitle: 'ICU Nurse', currentCompany: 'New Co', summary: 'Ten years ICU.', certifications: ['BLS', 'ACLS'], languages: ['Arabic', 'English'], experienceYears: 10 },
    ] } as never);
    const [row] = await prisma.candidateImportRow.findMany({ where: { jobId } });
    await imports.saveDecision(ORG, jobId, row!.id, { decision: 'Update' } as never);
    const res = await imports.confirmJob(ORG, jobId, ids.owner!);
    const linked = res.duplicateReport.find((r) => r.rowId === row!.id)!;
    expect(linked.action).toBe('linked');
    expect(linked.filled.sort()).toEqual(['certifications', 'currentTitle', 'experienceYears', 'summary'].sort());
    expect(linked.conflicts).toEqual([
      { field: 'currentCompany', existing: 'Old Co', incoming: 'New Co' },
      { field: 'languages', existing: ['Arabic'], incoming: ['Arabic', 'English'] },
    ]);
    const after = await prisma.candidate.findUniqueOrThrow({ where: { id } });
    expect(after).toMatchObject({ currentTitle: 'ICU Nurse', currentCompany: 'Old Co', summary: 'Ten years ICU.', certifications: ['BLS', 'ACLS'], languages: ['Arabic'], experienceYears: 10 });
  });
});
