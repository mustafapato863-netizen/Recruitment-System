#!/usr/bin/env node
/* B7 mapping report (scratch/staging only). node scripts/b7-mapping-report.cjs [--pre] [--label ".."] [--out file] */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require(path.join(__dirname, '..', 'database/generated/client'));
const args = process.argv.slice(2); const pre = args.includes('--pre');
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const prisma = new PrismaClient(); const q = (s) => prisma.$queryRawUnsafe(s);
async function main() {
  const out = []; const p = (s = '') => out.push(s);
  p('='.repeat(72)); p(`${arg('--label') ?? (pre ? 'BEFORE MIGRATION' : 'AFTER MIGRATION')}   ${new Date().toISOString()}`);
  p(`DB: ${(process.env.DATABASE_URL || '').replace(/\/\/[^@]*@/, '//***@')}`); p('-'.repeat(72));
  const has = async (t) => (await q(`SELECT to_regclass('public.${t}') IS NOT NULL ok`))[0].ok;
  const perm = await q(`SELECT r.code FROM role_permissions rp JOIN roles r ON r.id = rp."roleId" JOIN permissions p ON p.id = rp."permissionId" WHERE p.code = 'OFFER_PAY_VIEW' ORDER BY 1`);
  p(`OFFER_PAY_VIEW granted to roles: ${perm.map((r) => r.code).join(', ') || '(none)'}`);
  const sal = await q(`SELECT r.code FROM role_permissions rp JOIN roles r ON r.id = rp."roleId" JOIN permissions p ON p.id = rp."permissionId" WHERE p.code = 'VIEW_CURRENT_SALARY' ORDER BY 1`);
  p(`VIEW_CURRENT_SALARY (unchanged) roles: ${sal.map((r) => r.code).join(', ')}`);
  const lost = sal.filter((r) => !perm.some((x) => x.code === r.code)).map((r) => r.code);
  p(`Roles that saw offer pay via VIEW_CURRENT_SALARY and no longer do: ${lost.join(', ') || '(none)'}`);
  if (await has('grade_bands')) {
    const [b] = await q(`SELECT count(*)::int c, count(*) FILTER (WHERE status='Active')::int a FROM grade_bands`);
    p(`grade_bands: ${b.c} (active ${b.a})`);
  } else p('grade_bands: (table not present)');
  const [g] = await q(`SELECT count(*)::int c FROM master_data_values WHERE category='grades'`);
  p(`Grades in master data: ${g.c}`);
  const jobs = await q(`SELECT count(*)::int c, count(*) FILTER (WHERE vr."gradeId" IS NOT NULL)::int graded FROM vacancies v JOIN vacancy_requests vr ON vr.id = v."vacancyRequestId" WHERE v.status IN ('Open','On Hold','Partially Filled')`);
  p(`Live jobs: ${jobs[0].c}; with a grade (band check possible): ${jobs[0].graded}; without (decision -> GRADE_BAND_MISSING): ${jobs[0].c - jobs[0].graded}`);
  const pend = await q(`SELECT count(*)::int c FROM offer_versions ov JOIN offers o ON o."currentVersionId" = ov.id WHERE ov.status = 'Pending Approval'`);
  p(`Offer versions awaiting a decision (current, Pending Approval): ${pend[0].c}`);
  const own = await q(`SELECT count(*)::int open, count(*) FILTER (WHERE a."primaryRecruiterId" IS NULL)::int noowner, count(*) FILTER (WHERE u."managerId" IS NULL AND a."primaryRecruiterId" IS NOT NULL)::int nomgr FROM applications a LEFT JOIN users u ON u.id = a."primaryRecruiterId" WHERE a.stage NOT IN ('Joined','Rejected','Withdrawn')`);
  p(`Open files: ${own[0].open}; no owner (cannot be reassigned until owned): ${own[0].noowner}; owner has no manager (nobody can reassign/decide): ${own[0].nomgr}`);
  if (!pre && await has('offer_version_decisions')) {
    const [d] = await q(`SELECT (SELECT count(*) FROM offer_version_decisions)::int d, (SELECT count(*) FROM file_reassignments)::int r`);
    p(`offer_version_decisions: ${d.d}; file_reassignments: ${d.r} (new history tables start empty)`);
  }
  p('');
  const text = out.join('\n') + '\n'; if (arg('--out')) fs.appendFileSync(arg('--out'), text); process.stdout.write(text);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
