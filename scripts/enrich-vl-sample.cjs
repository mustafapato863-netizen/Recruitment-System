/* Enrich already-imported VL sample vacancies from the source workbook. */
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require(path.join(process.cwd(), 'apps/api/node_modules/xlsx'));

const workbookPath = process.argv[2] || 'D:\\Manpower\\VL.xlsx';
const apiBase = process.env.RECRUITFLOW_API_URL || 'http://127.0.0.1:3000/api/v1';
const email = process.env.RECRUITFLOW_ADMIN_EMAIL || 'admin@me.com';
const password = process.env.RECRUITFLOW_ADMIN_PASSWORD || 'Admin@123456';
const normalize = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const text = (value) => String(value ?? '').trim();
const field = (row, name) => { const key = Object.keys(row).find((candidate) => normalize(candidate) === normalize(name)); return key ? row[key] : null; };
const skillsFor = (title, department, section) => [...new Map(`${title} ${department || ''} ${section || ''}`.split(/[^A-Za-z0-9]+/).filter((value) => value.length > 2 && !['and','the','of','for','with','a','an','senior','junior','specialist','lead'].includes(value.toLowerCase())).map((value) => [value.toLowerCase(), value])).values()].slice(0, 8);
const minExperience = (level) => { const value = normalize(level); return value.includes('head') || value.includes('director') ? 7 : value.includes('manager') ? 5 : value.includes('supervisor') || value.includes('lead') ? 3 : value.includes('entry') ? 1 : 2; };

async function login() {
  const response = await fetch(`${apiBase}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!response.ok) throw new Error(`Login failed (${response.status}): ${await response.text()}`);
  const cookie = (response.headers.get('set-cookie') || '').match(/(?:^|,\s*)access_token=([^;]+)/)?.[1];
  if (!cookie) throw new Error('Login did not return an access token cookie.');
  return `access_token=${cookie}`;
}
async function api(cookie, pathname, options = {}) {
  const response = await fetch(`${apiBase}${pathname}`, { ...options, headers: { 'content-type': 'application/json', cookie, ...(options.headers || {}) } });
  const body = await response.text(); let parsed; try { parsed = body ? JSON.parse(body) : {}; } catch { parsed = body; }
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${pathname} (${response.status}): ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
  return parsed;
}
async function main() {
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const source = [];
  for (const sheetName of ['Rowdata', 'UAE VL ']) {
    const sheet = workbook.Sheets[sheetName]; if (!sheet) continue;
    XLSX.utils.sheet_to_json(sheet, { defval: null, blankrows: false, raw: true }).forEach((row) => {
      const title = text(field(row, 'Position')); if (!title) return;
      const vacant = Number(field(row, 'Vacant')) || 0; const total = Number(field(row, 'Total need')) || 0;
      if (vacant < 1 && total < 1 && normalize(field(row, 'Type')) !== 'vacant') return;
      source.push({ title, department: text(field(row, 'Department Name')) || text(field(row, 'Department')), section: text(field(row, 'Section')), level: text(field(row, 'Level')), entity: text(field(row, 'Entity')) });
    });
  }
  const byTitle = new Map(source.map((row) => [normalize(row.title), row]));
  const cookie = await login();
  const vacancies = await api(cookie, '/vacancies');
  const updated = [];
  for (const vacancy of Array.isArray(vacancies) ? vacancies : []) {
    const row = byTitle.get(normalize(vacancy.title || vacancy.position?.title));
    if (!row || !String(vacancy.position?.code || '').toUpperCase().startsWith('VL-')) continue;
    const sourceDescription = `Imported from VL.xlsx. Source entity: ${row.entity || 'unspecified'}. Source level: ${row.level || 'unspecified'}.`;
    const body = { location: row.entity || vacancy.location || undefined, department: row.department || undefined, requiredSkills: skillsFor(row.title, row.department, row.section), minExperienceYears: minExperience(row.level), jobSummary: `${row.title}${row.department ? ` — ${row.department}` : ''}`, description: sourceDescription };
    const enriched = await api(cookie, `/vacancies/${vacancy.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    updated.push({ id: enriched.id, vacancyCode: enriched.vacancyCode, title: enriched.title || row.title, requiredSkills: enriched.requiredSkills, minExperienceYears: enriched.minExperienceYears, location: enriched.location, department: enriched.department });
  }
  console.log(JSON.stringify({ source: workbookPath, updated }, null, 2));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
