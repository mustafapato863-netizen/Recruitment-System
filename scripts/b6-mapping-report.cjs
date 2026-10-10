#!/usr/bin/env node
/* B6 mapping report (scratch/staging only; never point at prod without review).
 * node scripts/b6-mapping-report.cjs [--pre] [--label "..."] [--out file]   (appends)
 * --pre: what the migration WILL map. Default: what it DID. Duplicates are REPORTED, never merged. */
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require(path.join(__dirname, '..', 'database/generated/client'));
const args = process.argv.slice(2);
const pre = args.includes('--pre');
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const prisma = new PrismaClient();
const q = (sql) => prisma.$queryRawUnsafe(sql);

// Same rules as apps/api/src/master-data/catalog-normalization.ts and candidates/contact-keys.ts
const key = (v) => String(v ?? '').replace(/[\u00a0\u2007\u202f]/g, ' ').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
const email = (v) => (String(v ?? '').trim().toLowerCase() || null);
function phone(raw) {
  const s = String(raw ?? '').trim(); let d = s.replace(/\D/g, '');
  if (!d) return null;
  if (s.startsWith('+')) {} else if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '966' + d.slice(1); else if (d.length <= 9) d = '966' + d;
  return d.length < 8 || d.length > 15 ? null : '+' + d;
}

async function main() {
  const out = []; const p = (s = '') => out.push(s);
  p('='.repeat(72));
  p(`${arg('--label') ?? (pre ? 'BEFORE MIGRATION (plan)' : 'AFTER MIGRATION')}   ${new Date().toISOString()}`);
  p(`DB: ${(process.env.DATABASE_URL || '').replace(/\/\/[^@]*@/, '//***@')}`);
  p('-'.repeat(72));
  const lib = await q(`SELECT id, "organizationId" org, name, status FROM master_data_values WHERE category='skills'`);
  const libKeys = new Map(); for (const v of lib) libKeys.set(`${v.org}|${key(v.name)}`, v);
  p(`Skill library entries: ${lib.length} (active ${lib.filter((v) => v.status === 'Active').length})`);
  const cands = await q(`SELECT id, "organizationId" org, "candidateCode" code, email, phone, skills FROM candidates`);
  let total = 0, matched = 0; const unmatched = new Map();
  for (const c of cands) for (const s of c.skills) { total++; if (libKeys.has(`${c.org}|${key(s)}`)) matched++; else unmatched.set(s.trim(), (unmatched.get(s.trim()) ?? 0) + 1); }
  p(`Candidate free-text skills: ${total}; ${pre ? 'will map' : 'map'} to library: ${matched}; unmatched (kept as free text): ${total - matched}`);
  if (unmatched.size) p('  Unmatched: ' + [...unmatched.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([s, n]) => `${s} (${n})`).join(', '));
  const vacs = await q(`SELECT "organizationId" org, "requiredSkills" req FROM vacancies`);
  let vt = 0, vm = 0; const vun = new Set();
  for (const v of vacs) for (const s of v.req) { vt++; if (libKeys.has(`${v.org}|${key(s)}`)) vm++; else vun.add(s.trim()); }
  p(`Job required skills: ${vt}; in library: ${vm}; not in library (suggest cannot evidence them): ${vt - vm}`);
  if (vun.size) p('  Not in library: ' + [...vun].sort().join(', '));
  if (!pre) {
    const [links] = await q(`SELECT count(*)::int c FROM candidate_skills`);
    const [ev] = await q(`SELECT count(*)::int c FROM candidate_skill_evidence`);
    p(`candidate_skills rows: ${links.c}; evidence rows: ${ev.c} (migration creates no evidence: a listed skill is "No evidence")`);
    const [mism] = await q(`SELECT count(*)::int c FROM candidates WHERE "emailNormalized" IS DISTINCT FROM rf_normalize_email(email) OR "phoneNormalized" IS DISTINCT FROM rf_normalize_phone(phone)`);
    p(`Normalized contact keys out of sync: ${mism.c} (expected 0)`);
  }
  // duplicates (report only)
  const groups = (fn) => { const m = new Map(); for (const c of cands) { const k = fn(c); if (!k) continue; const g = m.get(`${c.org}|${k}`) ?? []; g.push(c.code); m.set(`${c.org}|${k}`, g); } return [...m.entries()].filter(([, g]) => g.length > 1); };
  const de = groups((c) => email(c.email)); const dp = groups((c) => phone(c.phone));
  p(`Existing duplicates (NOT merged): by email ${de.length} group(s), by phone ${dp.length} group(s)`);
  for (const [k, g] of de) p(`  email ${k.split('|')[1]}: ${g.join(', ')}`);
  for (const [k, g] of dp) p(`  phone ${k.split('|')[1]}: ${g.join(', ')}`);
  const [badPhones] = [cands.filter((c) => c.phone && !phone(c.phone)).length];
  p(`Phones that do not normalize (kept, key NULL): ${badPhones}`);
  p('');
  const text = out.join('\n') + '\n';
  if (arg('--out')) fs.appendFileSync(arg('--out'), text);
  process.stdout.write(text);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
