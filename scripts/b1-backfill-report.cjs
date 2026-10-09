#!/usr/bin/env node
/* B1 backfill report (read-only): which jobs got an owner from the
 * 20261010_b1_vacancy_primary_recruiter migration and which stayed NULL, and why.
 *
 * Usage: DATABASE_URL=... node scripts/b1-backfill-report.cjs [--out report.txt]
 */
const path = require('node:path');
const fs = require('node:fs');
const repoRoot = path.resolve(__dirname, '..');
const dotenv = require(path.join(repoRoot, 'database/node_modules/dotenv'));
const { PrismaClient } = require(path.join(repoRoot, 'database/generated/client'));

dotenv.config({ path: path.join(repoRoot, '.env') });
const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outPath = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : null;

/** Classify one vacancy; exported shape is also used by tests. */
function classify(vacancy) {
  const primaries = vacancy.assignments.filter((a) => a.isActive && a.assignmentKind === 'PRIMARY');
  const distinct = [...new Map(primaries.map((a) => [a.user.id, a.user])).values()];
  if (vacancy.primaryRecruiterId) {
    const owner = distinct.find((u) => u.id === vacancy.primaryRecruiterId);
    return { outcome: 'BACKFILLED', reason: 'single active non-admin PRIMARY', owner: owner || { id: vacancy.primaryRecruiterId } };
  }
  if (distinct.length === 0) return { outcome: 'NULL', reason: 'NO_PRIMARY_ASSIGNMENT' };
  if (distinct.length > 1) return { outcome: 'NULL', reason: 'MULTIPLE_PRIMARY_ASSIGNMENTS', candidates: distinct };
  const user = distinct[0];
  if (user.userRoles.some((ur) => ur.role.code === 'ADMINISTRATOR')) return { outcome: 'NULL', reason: 'PRIMARY_IS_ADMIN', candidates: distinct };
  if (user.status !== 'Active') return { outcome: 'NULL', reason: 'PRIMARY_INACTIVE', candidates: distinct };
  if (user.organizationId !== vacancy.organizationId) return { outcome: 'NULL', reason: 'PRIMARY_OTHER_ORGANIZATION', candidates: distinct };
  return { outcome: 'NULL', reason: 'NOT_BACKFILLED_UNKNOWN', candidates: distinct };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const vacancies = await prisma.vacancy.findMany({
      select: {
        id: true, vacancyCode: true, status: true, organizationId: true, primaryRecruiterId: true,
        position: { select: { title: true } }, branch: { select: { name: true } },
        assignments: {
          select: {
            isActive: true, assignmentKind: true,
            user: { select: { id: true, displayName: true, email: true, status: true, organizationId: true, userRoles: { select: { role: { select: { code: true } } } } } },
          },
        },
      },
      orderBy: { vacancyCode: 'asc' },
    });
    const rows = vacancies.map((v) => ({ v, c: classify(v) }));
    const counts = rows.reduce((acc, { c }) => { const k = c.outcome === 'BACKFILLED' ? 'BACKFILLED' : c.reason; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    const lines = [];
    lines.push('B1 backfill report: vacancies.primaryRecruiterId');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Database: ${(process.env.DATABASE_URL || '').replace(/\/\/[^@]*@/, '//***@')}`);
    lines.push(`Total vacancies: ${vacancies.length}`);
    for (const [k, n] of Object.entries(counts).sort()) lines.push(`  ${k}: ${n}`);
    lines.push('');
    lines.push('Flagged (left NULL, need a human owner decision; admins are never auto-assigned):');
    for (const { v, c } of rows.filter((r) => r.c.outcome === 'NULL')) {
      const who = (c.candidates || []).map((u) => `${u.displayName} <${u.email}> [${u.status}; ${u.userRoles.map((r) => r.role.code).join(',')}]`).join(' | ');
      lines.push(`  ${v.vacancyCode}  ${v.status.padEnd(18)} ${v.position.title} @ ${v.branch.name}  ->  ${c.reason}${who ? `  candidates: ${who}` : ''}`);
    }
    lines.push('');
    lines.push('Backfilled:');
    for (const { v, c } of rows.filter((r) => r.c.outcome === 'BACKFILLED')) {
      lines.push(`  ${v.vacancyCode}  ${v.status.padEnd(18)} ${v.position.title} @ ${v.branch.name}  ->  ${c.owner.displayName || c.owner.id}`);
    }
    const text = lines.join('\n') + '\n';
    if (outPath) { fs.mkdirSync(path.dirname(outPath), { recursive: true }); fs.writeFileSync(outPath, text); }
    process.stdout.write(text);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
}
module.exports = { classify };
