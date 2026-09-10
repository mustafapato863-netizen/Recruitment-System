#!/usr/bin/env node
/* Seed the first-version catalogs that drive recruiter selectors.
 * Dry-run by default; pass --apply and --organization-id to write.
 */
const path = require('node:path');
const crypto = require('node:crypto');
const dotenv = require(path.join(process.cwd(), 'database/node_modules/dotenv'));
const { PrismaClient } = require(path.join(process.cwd(), 'database/generated/client'));

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const args = process.argv.slice(2);
const apply = args.includes('--apply');
function valueFor(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const organizationIdArg = valueFor('--organization-id') || process.env.DEFAULT_ORGANIZATION_ID;

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

const CANDIDATE_SOURCES = [
  ['CV_INTAKE_UPLOAD', 'CV Intake Upload', { type: 'Upload' }],
  ['CAREER_SITE', 'Career Site', { type: 'Owned' }],
  ['DIRECT_SOURCING', 'Direct Sourcing', { type: 'Direct' }],
  ['LINKEDIN', 'LinkedIn', { type: 'Job Board' }],
  ['OTHER_JOB_BOARD', 'Other Job Board', { type: 'Job Board' }],
  ['EMPLOYEE_REFERRAL', 'Employee Referral', { type: 'Referral' }],
  ['RECRUITMENT_AGENCY', 'Recruitment Agency', { type: 'Agency' }],
  ['WALK_IN', 'Walk-in', { type: 'Direct' }],
  ['CAMPUS_RECRUITMENT', 'Campus Recruitment', { type: 'Event' }],
  ['OTHER', 'Other', { type: 'Other' }],
];

const INTERVIEW_TYPES = [
  ['SCREENING', 'Screening', { defaultDuration: 30 }],
  ['TECHNICAL', 'Technical', { defaultDuration: 60 }],
  ['BEHAVIORAL', 'Behavioral', { defaultDuration: 45 }],
  ['MANAGERIAL', 'Managerial', { defaultDuration: 45 }],
  ['EXECUTIVE', 'Executive', { defaultDuration: 45 }],
];

function printPlan() {
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    candidateSources: CANDIDATE_SOURCES.map(([, name]) => name),
    interviewTypes: INTERVIEW_TYPES.map(([, name]) => name),
    note: apply ? 'Existing records are preserved and reactivated by stable code.' : 'No database changes were made. Add --apply to write these records.',
  }, null, 2));
}

async function resolveOrganizationId(prisma) {
  if (organizationIdArg) return organizationIdArg;
  const organizations = await prisma.organization.findMany({ where: { status: 'Active' }, select: { id: true, code: true } });
  if (organizations.length !== 1) throw new Error(`Pass --organization-id. Found ${organizations.length} active organizations.`);
  return organizations[0].id;
}

async function seedCatalog(prisma, organizationId, category, rows) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`master-data:${organizationId}:${category}`}))`;
    const existing = await tx.masterDataValue.findMany({ where: { organizationId, category } });
    const byCode = new Map(existing.filter((record) => record.code).map((record) => [record.code, record]));
    const byName = new Map(existing.map((record) => [record.name.trim().toLocaleLowerCase('en-US'), record]));
    let created = 0;
    let updated = 0;
    for (const [code, name, metadata] of rows) {
      const current = byCode.get(code) || byName.get(name.toLocaleLowerCase('en-US'));
      if (current) {
        if (current.code !== code || current.name !== name || current.status !== 'Active' || !sameJson(current.metadata, metadata)) {
          await tx.masterDataValue.update({
            where: { id: current.id },
            data: { code, name, metadata, status: 'Active', version: { increment: 1 } },
          });
          updated += 1;
        }
      } else {
        const record = await tx.masterDataValue.create({
          data: { id: crypto.randomUUID(), organizationId, category, code, name, metadata, status: 'Active' },
        });
        byCode.set(code, record);
        byName.set(name.toLocaleLowerCase('en-US'), record);
        created += 1;
      }
    }
    return { created, updated };
  });
}

async function main() {
  if (!apply) {
    printPlan();
    return;
  }
  const prisma = new PrismaClient();
  try {
    const organizationId = await resolveOrganizationId(prisma);
    const [sources, interviewTypes] = await Promise.all([
      seedCatalog(prisma, organizationId, 'candidate-sources', CANDIDATE_SOURCES),
      seedCatalog(prisma, organizationId, 'interview-types', INTERVIEW_TYPES),
    ]);
    console.log(JSON.stringify({ organizationId, sources, interviewTypes }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
