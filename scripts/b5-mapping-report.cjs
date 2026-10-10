#!/usr/bin/env node
/* B5 mapping report (scratch/staging only; never point at prod without review).
 * node scripts/b5-mapping-report.cjs [--pre] [--label "..."] [--out file]   (appends)
 * --pre: what the migration WILL do. Default: what it DID. */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require(path.join(__dirname, '..', 'database/generated/client'));
const args = process.argv.slice(2);
const pre = args.includes('--pre');
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const prisma = new PrismaClient();
const q = (sql) => prisma.$queryRawUnsafe(sql);
const n = (v) => Number(v);
const ID = "(^|[^a-z])(id|identity|passport|emirates id|national id|iqama)([^a-z]|$)";

async function hasColumn(table, col) {
  const r = await q(`SELECT 1 FROM information_schema.columns WHERE table_name='${table}' AND column_name='${col}'`);
  return r.length > 0;
}

async function main() {
  const out = [];
  const p = (s = '') => out.push(s);
  p('='.repeat(72));
  p(`${arg('--label') ?? (pre ? 'BEFORE MIGRATION (plan)' : 'AFTER MIGRATION')}   ${new Date().toISOString()}`);
  p(`DB: ${(process.env.DATABASE_URL || '').replace(/\/\/[^@]*@/, '//***@')}`);
  p('-'.repeat(72));
  const stages = await q(`SELECT stage, count(*)::int c FROM applications GROUP BY stage ORDER BY stage`);
  p('Application stages: ' + stages.map((r) => `${r.stage}=${r.c}`).join(', '));
  if (pre) {
    const [sc] = await q(`SELECT count(*)::int c FROM applications WHERE stage='Scorecard'`);
    const [nw] = await q(`SELECT count(*)::int c FROM applications WHERE stage='New'`);
    p(`Stage remap plan: Scorecard -> Interview: ${sc.c}`);
    p(`                  New -> Applied: ${nw.c}`);
    const hired = await q(`SELECT a.id, a."applicationCode" code,
        coalesce(bool_or(cr.status='Verified' AND lower(cr.name) ~ '${ID}'),false) id_ok,
        coalesce(bool_or(cr.status='Verified' AND lower(cr.name) LIKE '%contract%'),false) contract_ok,
        coalesce(bool_or(cr.status='Verified' AND (lower(cr.name) LIKE '%scfhs%' OR lower(cr.name) LIKE '%licen%')),false) licence_ok
      FROM applications a LEFT JOIN hiring_cases hc ON hc."applicationId"=a.id LEFT JOIN compliance_requirements cr ON cr."hiringCaseId"=hc.id
      WHERE a.stage='Hired' GROUP BY a.id, a."applicationCode" ORDER BY 2`);
    const joined = hired.filter((h) => h.id_ok && h.contract_ok && h.licence_ok);
    p(`                  Hired -> Joined (3 checks done): ${joined.length}; Hired -> Pre-Hire: ${hired.length - joined.length}`);
    for (const h of hired) p(`    ${h.code}: ID ${h.id_ok ? 'ok' : 'missing'}, contract ${h.contract_ok ? 'ok' : 'missing'}, licence ${h.licence_ok ? 'ok' : 'missing'}`);
    const [sent] = await q(`SELECT count(*)::int c FROM offers WHERE status='Sent to Candidate'`);
    p(`Offer status plan: "Sent to Candidate" -> "Sent": ${sent.c}`);
    const [wd] = await q(`SELECT count(*)::int c FROM applications WHERE stage='Withdrawn'`);
    p(`                  Withdrawn -> Rejected ("Withdrawn by candidate"): ${wd.c}`);
    if (await hasColumn('interview_scorecards', 'isLocked')) {
      const s = await q(`SELECT "isLocked" l, count(*)::int c FROM interview_scorecards GROUP BY 1`);
      p('Scorecards isLocked -> status: ' + s.map((r) => `${r.l ? 'locked->Submitted' : 'unlocked->Draft'}=${r.c}`).join(', ') || 'none');
    }
    if (await hasColumn('offer_versions', 'isLocked')) {
      const s = await q(`SELECT ov."approvalStatus" a, ov."isLocked" l, (o."currentVersionId"=ov.id) cur, o.status os, count(*)::int c
        FROM offer_versions ov JOIN offers o ON o.id=ov."offerId" GROUP BY 1,2,3,4 ORDER BY 1,2,3,4`);
      p('Offer versions (approvalStatus/isLocked/current/offer status -> count):');
      for (const r of s) p(`    ${r.a}/${r.l ? 'locked' : 'unlocked'}/${r.cur ? 'current' : 'older'}/${r.os}: ${r.c}`);
    }
    if (await hasColumn('interviews', 'interviewerName')) {
      const rows = await q(`SELECT i."interviewCode" code, i."interviewerName" name,
          (SELECT count(DISTINCT u.id)::int FROM users u WHERE u."organizationId"=i."organizationId"
            AND (lower(btrim(u."displayName"))=lower(btrim(i."interviewerName")) OR lower(u.email)=lower(btrim(i."interviewerName")))) m
        FROM interviews i WHERE coalesce(btrim(i."interviewerName"),'')<>'' ORDER BY 1`);
      const matched = rows.filter((r) => r.m === 1);
      p(`Free-text interviewers: ${rows.length}; matched to exactly one user: ${matched.length}; unmatched: ${rows.filter((r) => r.m === 0).length}; ambiguous: ${rows.filter((r) => r.m > 1).length}`);
      for (const r of rows.filter((x) => x.m !== 1)) p(`    NOT MAPPED ${r.code}: "${r.name}" (${r.m === 0 ? 'no user' : r.m + ' users match'}) -> kept in legacyInterviewerName`);
    }
  } else {
    const hist = await q(`SELECT reason, count(*)::int c FROM application_status_histories WHERE reason LIKE 'B5 migration:%' GROUP BY 1 ORDER BY 1`);
    p('Migration history rows:'); for (const r of hist) p(`    ${r.reason}: ${r.c}`);
    const [norm] = await q(`SELECT count(DISTINCT "entityId")::int c FROM audit_logs WHERE action='B5_MIGRATION_OFFER_STATUS_NORMALIZED'`);
    const os = await q(`SELECT status, count(*)::int c FROM offers GROUP BY 1 ORDER BY 1`);
    p(`Offers normalized "Sent to Candidate" -> "Sent": ${norm.c}; offer status now: ${os.map((r) => `${r.status}=${r.c}`).join(', ') || 'none'}`);
    const s = await q(`SELECT status, count(*)::int c FROM interview_scorecards GROUP BY 1 ORDER BY 1`);
    p('Scorecard status: ' + (s.map((r) => `${r.status}=${r.c}`).join(', ') || 'none'));
    const o = await q(`SELECT status, count(*)::int c FROM offer_versions GROUP BY 1 ORDER BY 1`);
    p('Offer version status: ' + (o.map((r) => `${r.status}=${r.c}`).join(', ') || 'none'));
    const leg = await q(`SELECT i."interviewCode" code, i."legacyInterviewerName" name,
        EXISTS (SELECT 1 FROM interview_attendees a JOIN users u ON u.id=a."userId" WHERE a."interviewId"=i.id
          AND (lower(btrim(u."displayName"))=lower(btrim(i."legacyInterviewerName")) OR lower(u.email)=lower(btrim(i."legacyInterviewerName")))) mapped
      FROM interviews i WHERE i."legacyInterviewerName" IS NOT NULL ORDER BY 1`);
    p(`Legacy interviewer names: ${leg.length}; mapped to an attendee user: ${leg.filter((r) => r.mapped).length}; unmatched (kept as history only): ${leg.filter((r) => !r.mapped).length}`);
    for (const r of leg.filter((x) => !x.mapped)) p(`    UNMATCHED ${r.code}: "${r.name}"`);
    const rr = await q(`SELECT o.code org, count(m.*)::int c FROM organizations o LEFT JOIN master_data_values m ON m."organizationId"=o.id AND m.category='rejection-reasons' GROUP BY 1 ORDER BY 1`);
    p('Rejection reasons per org: ' + rr.map((r) => `${r.org}=${r.c}`).join(', '));
    const rej = await q(`SELECT coalesce("rejectionReason",'(none recorded)') r, count(*)::int c FROM applications WHERE stage='Rejected' GROUP BY 1 ORDER BY 1`);
    p('Rejected files by reason: ' + (rej.map((r) => `${r.r}=${r.c}`).join(', ') || 'none'));
    const [locked] = await q(`SELECT count(*)::int c FROM information_schema.columns WHERE column_name='isLocked' AND table_name IN ('interview_scorecards','offer_versions')`);
    p(`isLocked columns left: ${locked.c} (expected 0)`);
  }
  // B5 follow-ups (migration 20261010_b5b_file_followups): typed joining checks.
  {
    const names = await q(`SELECT cr.name, cr.status FROM compliance_requirements cr JOIN hiring_cases hc ON hc.id = cr."hiringCaseId"`);
    const ID_RE = /(^|[^a-z])(id|identity|passport|emirates id|national id|iqama)([^a-z]|$)/i;
    const typeOf = (n) => [ID_RE.test(n) && 'ID', /contract/i.test(n) && 'CONTRACT', /(scfhs|licen[cs]e)/i.test(n) && 'SCFHS_LICENCE'].filter(Boolean);
    const unmatched = names.filter((r) => typeOf(r.name).length === 0);
    p(`Compliance requirements on hiring cases: ${names.length}; match a joining-check type: ${names.length - unmatched.length}; unmatched (not mapped): ${unmatched.length}`);
    for (const n of [...new Set(unmatched.map((r) => r.name))].slice(0, 20)) p(`    unmatched: ${n}`);
    if ((await q(`SELECT to_regclass('public.joining_checks') IS NOT NULL ok`))[0].ok) {
      const rows = await q(`SELECT type, verified, count(*)::int c FROM joining_checks GROUP BY 1,2 ORDER BY 1,2`);
      p('joining_checks (type/verified -> count): ' + (rows.map((r) => `${r.type}/${r.verified ? 'verified' : 'not verified'}=${r.c}`).join(', ') || 'none'));
      const [pre] = await q(`SELECT count(*)::int c FROM applications a WHERE a.stage = 'Pre-Hire'`);
      const [ready] = await q(`SELECT count(*)::int c FROM applications a WHERE a.stage = 'Pre-Hire' AND (SELECT count(*) FROM joining_checks j WHERE j."applicationId" = a.id AND j.verified) = 3`);
      p(`Pre-Hire files: ${pre.c}; gate 4 satisfied by typed checks: ${ready.c}`);
    } else {
      p('joining_checks: (table not present)');
    }
  }
  p('');
  const text = out.join('\n') + '\n';
  if (arg('--out')) fs.appendFileSync(arg('--out'), text);
  process.stdout.write(text);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
