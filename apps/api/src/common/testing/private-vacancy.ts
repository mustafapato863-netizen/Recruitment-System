/**
 * Test-only helper (scratch Postgres): a private, unowned copy of a seeded job with its own requisition and code.
 * Suites that need "a job nobody owns" use this instead of grabbing seeded jobs, which other suites
 * running in parallel against the same database also pick and re-own (B2-21 flakes).
 */
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@recruitflow/database';

export async function privateVacancy(prisma: Pick<PrismaClient, 'vacancy' | '$executeRawUnsafe'>, organizationId: string, label: string): Promise<string> {
  const tpl = await prisma.vacancy.findFirstOrThrow({ where: { organizationId, status: 'Open' }, orderBy: { createdAt: 'asc' } });
  const reqId = randomUUID(); const vacId = randomUUID(); const tag = `${label}-${vacId.slice(0, 8)}`;
  await prisma.$executeRawUnsafe(`INSERT INTO "vacancy_requests" SELECT (jsonb_populate_record(NULL::"vacancy_requests", to_jsonb(r) || jsonb_build_object('id', $1::text, 'requestCode', $2::text))).* FROM "vacancy_requests" r WHERE r."id" = $3::uuid`, reqId, `TR-${tag}`, tpl.vacancyRequestId);
  // Mid-list code and a fresh createdAt so "first/last seeded job" pickers in other suites never select it.
  await prisma.$executeRawUnsafe(`INSERT INTO "vacancies" SELECT (jsonb_populate_record(NULL::"vacancies", to_jsonb(v) || jsonb_build_object('id', $1::text, 'vacancyCode', $2::text, 'vacancyRequestId', $3::text, 'primaryRecruiterId', NULL, 'createdAt', now(), 'updatedAt', now()))).* FROM "vacancies" v WHERE v."id" = $4::uuid`, vacId, `VAC-2026-005-${tag}`, reqId, tpl.id);
  return vacId;
}
