#!/usr/bin/env node
/* B3 mapping report (read-only). Run before the 20261010_b3_req_job_lifecycle
 * migration with --pre to see what will be mapped, and after it to see what was.
 * NEVER point at production without approval.
 *
 * Usage: DATABASE_URL=... node scripts/b3-mapping-report.cjs [--pre] [--label name] [--out report.txt]
 */
const path = require('node:path');
const fs = require('node:fs');
const repoRoot = path.resolve(__dirname, '..');
const dotenv = require(path.join(repoRoot, 'database/node_modules/dotenv'));
const { PrismaClient } = require(path.join(repoRoot, 'database/generated/client'));

dotenv.config({ path: path.join(repoRoot, '.env') });
const args = process.argv.slice(2);
const pre = args.includes('--pre');
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const outPath = opt('--out') ? path.resolve(opt('--out')) : null;
const label = opt('--label') || (pre ? 'pre-migration' : 'post-migration');

const prisma = new PrismaClient();
const q = (sql) => prisma.$queryRawUnsafe(sql).then((rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]))));

(async () => {
  const lines = [`B3 mapping report (${label}) — ${new Date().toISOString()}`, `database: ${(process.env.DATABASE_URL || '').replace(/\/\/[^@]*@/, '//***@')}`, ''];
  const jobs = await q(`SELECT status, count(*)::int AS n FROM vacancies GROUP BY status ORDER BY status`);
  const reqs = await q(`SELECT status, count(*)::int AS n FROM vacancy_requests GROUP BY status ORDER BY status`);
  lines.push('Job statuses:', ...(jobs.length ? jobs.map((r) => `  ${r.status}: ${r.n}`) : ['  (no jobs)']));
  lines.push('Requisition statuses:', ...(reqs.length ? reqs.map((r) => `  ${r.status}: ${r.n}`) : ['  (no requisitions)']), '');

  const hireTasks = await q(`SELECT status, count(*)::int AS n FROM tasks WHERE title ILIKE 'Hire Target:%' GROUP BY status`);
  lines.push('Hire-target tasks (v2 §8; not rewritten by B3, seats already on the requisition, chip moves in B4):',
    ...(hireTasks.length ? hireTasks.map((r) => `  ${r.status}: ${r.n}`) : ['  none']), '');

  if (pre) {
    const [m] = await q(`SELECT
      count(*) FILTER (WHERE v.status = 'Cancelled')::int AS cancelled_to_closed,
      count(*) FILTER (WHERE v.status = 'Cancelled' AND r.status <> 'Cancelled')::int AS requisitions_to_cancelled,
      count(*) FILTER (WHERE v.status = 'Closed' AND v."approvedHeadcount" > 0 AND v."joinedHeadcount" >= v."approvedHeadcount")::int AS closed_filled_to_filled,
      count(*) FILTER (WHERE v.status = 'Pending Activation' AND COALESCE(btrim(v."jobSummary"), '') <> '' AND EXISTS (SELECT 1 FROM vacancy_assignments a WHERE a."vacancyId" = v.id AND a."isActive" AND a."assignmentKind" = 'PRIMARY'))::int AS pending_to_open,
      count(*) FILTER (WHERE v.status = 'Pending Activation' AND NOT (COALESCE(btrim(v."jobSummary"), '') <> '' AND EXISTS (SELECT 1 FROM vacancy_assignments a WHERE a."vacancyId" = v.id AND a."isActive" AND a."assignmentKind" = 'PRIMARY')))::int AS pending_to_requisition_approved
      FROM vacancies v JOIN vacancy_requests r ON r.id = v."vacancyRequestId"`);
    lines.push('Planned mapping:', ...Object.entries(m).map(([k, v]) => `  ${k}: ${v}`));
  } else {
    const mapped = await q(`SELECT "fromStatus", "toStatus", split_part(reason, ';', 1) AS rule, count(*)::int AS n FROM vacancy_status_histories WHERE reason LIKE 'B3 migration%' GROUP BY 1,2,3 ORDER BY 3`);
    lines.push('Applied mapping (from vacancy_status_histories, reason "B3 migration..."):', ...(mapped.length ? mapped.map((r) => `  ${r.fromStatus} -> ${r.toStatus}: ${r.n}   (${r.rule})`) : ['  none (nothing to map)']));
    const [a] = await q(`SELECT count(*) FILTER (WHERE "assignedEmployeeId" IS NOT NULL)::int AS with_assignee, count(*) FILTER (WHERE "activatedAt" IS NOT NULL)::int AS activated, count(*) FILTER (WHERE status = 'Converted to Vacancy' AND "assignedEmployeeId" IS NULL)::int AS activated_without_eligible_assignee FROM vacancy_requests`);
    lines.push('Requisition backfill:', ...Object.entries(a).map(([k, v]) => `  ${k}: ${v}`));
    const left = await q(`SELECT count(*)::int AS n FROM vacancies WHERE status IN ('Cancelled', 'Pending Activation')`);
    lines.push(`Jobs still Cancelled / Pending Activation: ${left[0].n}`);
  }
  if (!pre) {
    // E3 additions: reason lists and hold-until.
    const reasons = await prisma.$queryRawUnsafe(`SELECT category, status, count(*)::int c FROM master_data_values WHERE category IN ('hold-reasons','close-reasons') GROUP BY 1,2 ORDER BY 1,2`);
    lines.push('Reason lists (category/status -> count): ' + (reasons.map((r) => `${r.category}/${r.status}=${r.c}`).join(', ') || 'none'));
    const [hu] = await prisma.$queryRawUnsafe(`SELECT count(*) FILTER (WHERE "holdUntil" IS NOT NULL)::int c FROM vacancies`);
    lines.push(`Jobs with holdUntil set: ${hu.c} (new column, starts empty)`);
  }
  const text = lines.join('\n') + '\n';
  process.stdout.write(text);
  if (outPath) fs.appendFileSync(outPath, text + '\n');
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
