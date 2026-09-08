/*
 * Import a small, repeatable sample from the Manpower VL workbook.
 *
 * Usage (from the repository root):
 *   node scripts/import-vl-sample.cjs [workbook path] [sample size]
 *
 * The script deliberately reads the workbook at runtime and uses the same
 * review/confirm and vacancy approval APIs as the application. It never
 * embeds workbook rows in frontend code and never imports the full workbook.
 */
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require(path.join(process.cwd(), 'apps/api/node_modules/xlsx'));

const workbookPath = process.argv[2] || 'D:\\Manpower\\VL.xlsx';
const requestedSampleSize = Math.max(1, Math.min(12, Number(process.argv[3] || 6)));
const apiBase = process.env.RECRUITFLOW_API_URL || 'http://127.0.0.1:3000/api/v1';
const email = process.env.RECRUITFLOW_ADMIN_EMAIL || 'admin@me.com';
const password = process.env.RECRUITFLOW_ADMIN_PASSWORD || 'Admin@123456';

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function field(row, name) {
  const expected = normalize(name);
  const key = Object.keys(row).find((candidate) => normalize(candidate) === expected);
  return key ? row[key] : null;
}

function text(value) {
  return String(value ?? '').trim();
}

function number(value) {
  const parsed = Number(text(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function slug(value) {
  return normalize(value).replace(/ /g, '-').slice(0, 42) || 'position';
}

function csvCell(value) {
  const raw = Array.isArray(value) ? value.join(', ') : text(value);
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

function sourceRows() {
  if (!fs.existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`);
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const rows = [];
  for (const sheetName of ['Rowdata', 'UAE VL ']) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const values = XLSX.utils.sheet_to_json(sheet, { defval: null, blankrows: false, raw: true });
    values.forEach((row, index) => {
      const title = text(field(row, 'Position'));
      if (!title) return;
      const vacant = number(field(row, 'Vacant'));
      const totalNeed = number(field(row, 'Total need'));
      const type = normalize(field(row, 'Type'));
      if (vacant < 1 && totalNeed < 1 && type !== 'vacant') return;
      rows.push({
        sheetName,
        sourceRow: index + 2,
        title,
        department: text(field(row, 'Department Name')) || text(field(row, 'Department')),
        section: text(field(row, 'Section')),
        level: text(field(row, 'Level')),
        status: text(field(row, 'Status')),
        type: text(field(row, 'Type')),
        entity: text(field(row, 'Entity')),
        headcount: Math.max(1, Math.round(totalNeed || vacant || 1)),
        criticality: text(field(row, 'Critical')),
        compensation: text(field(row, 'Offered')) || text(field(row, 'Compensation')),
      });
    });
  }

  const seen = new Set();
  return rows.filter((row) => {
    const key = normalize(row.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, requestedSampleSize);
}

function recommendedSkills(row) {
  const stopWords = new Set(['and', 'the', 'of', 'for', 'with', 'a', 'an', 'senior', 'junior', 'specialist', 'lead']);
  const tokens = `${row.title} ${row.department} ${row.section}`
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token.toLowerCase()));
  return [...new Map(tokens.map((token) => [token.toLowerCase(), token])).values()].slice(0, 8);
}

function minimumExperience(level) {
  const value = normalize(level);
  if (value.includes('head') || value.includes('director')) return 7;
  if (value.includes('manager')) return 5;
  if (value.includes('supervisor') || value.includes('lead')) return 3;
  return value.includes('entry') ? 1 : 2;
}

async function request(pathname, options = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...(options.headers || {}) },
  });
  const body = await response.text();
  let parsed;
  try { parsed = body ? JSON.parse(body) : {}; } catch { parsed = body; }
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${pathname} (${response.status}): ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
  return parsed;
}

function accessCookie(response) {
  const setCookie = response.headers.get('set-cookie') || '';
  const match = setCookie.match(/(?:^|,\s*)access_token=([^;]+)/);
  if (!match) throw new Error('Login succeeded but the access_token cookie was not returned.');
  return `access_token=${match[1]}`;
}

async function login() {
  const response = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login failed (${response.status}): ${await response.text()}`);
  const body = await response.json();
  return { cookie: accessCookie(response), user: body.user };
}

async function requestWithCookie(cookie, pathname, options = {}) {
  return request(pathname, { ...options, headers: { ...(options.headers || {}), cookie } });
}

async function uploadAndConfirm(cookie, dataset, filename, csv) {
  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), filename);
  const uploaded = await requestWithCookie(cookie, dataset === 'positions' ? '/imports/master-data/positions/upload' : '/imports/vacancy-requests/upload', { method: 'POST', body: form });
  const jobId = uploaded.jobId;
  const rows = await requestWithCookie(cookie, dataset === 'positions' ? `/imports/master-data/positions/jobs/${jobId}/rows?page=1&pageSize=100` : `/imports/vacancy-requests/jobs/${jobId}/rows?page=1&pageSize=100`);
  for (const row of rows.rows || []) {
    if (row.result !== 'Duplicate') continue;
    const base = dataset === 'positions' ? `/imports/master-data/positions/jobs/${jobId}/rows/${row.id}/decision/Skip` : `/imports/vacancy-requests/jobs/${jobId}/rows/${row.id}/decision/Skip`;
    await requestWithCookie(cookie, base, { method: 'POST' });
  }
  const confirmed = await requestWithCookie(cookie, dataset === 'positions' ? `/imports/master-data/positions/jobs/${jobId}/confirm` : `/imports/vacancy-requests/jobs/${jobId}/confirm`, { method: 'POST' });
  return { jobId, confirmed };
}

async function main() {
  const rows = sourceRows();
  if (rows.length === 0) throw new Error('No open vacancy rows were found in Rowdata or UAE VL.');
  const outputDir = path.join(process.cwd(), 'tmp', 'vl-sample');
  fs.mkdirSync(outputDir, { recursive: true });
  const positionHeaders = ['Code', 'Title', 'Description', 'Status'];
  const positionRows = rows.map((row) => {
    const code = `VL-${slug(row.title).toUpperCase()}`;
    return [code, row.title, `Source: VL.xlsx / ${row.sheetName} row ${row.sourceRow}. Department: ${row.department || '—'}. Section: ${row.section || '—'}. Level: ${row.level || '—'}. Source status: ${row.status || '—'}.`, 'Active'];
  });
  const vacancyHeaders = ['Position Code', 'Position Title', 'Branch Code', 'Legal Entity Code', 'Requested Headcount', 'Employment Type', 'Budget Status', 'Criticality', 'Required Skills', 'Minimum Experience Years', 'Work Location', 'External Vacancy Code', 'Justification', 'Job Summary', 'Role Description', 'Qualifications', 'Benefits'];
  const vacancyRows = rows.map((row) => {
    const code = `VL-${slug(row.title).toUpperCase()}`;
    const skills = recommendedSkills(row);
    const source = `Source: VL.xlsx / ${row.sheetName} row ${row.sourceRow}; entity ${row.entity || 'unspecified'}; department ${row.department || 'unspecified'}; section ${row.section || 'unspecified'}; source status ${row.status || 'unspecified'}.`;
    return [code, row.title, 'DXB-MAIN', 'HQ', row.headcount, 'Full-time', 'Budgeted', row.criticality || '', skills.join(', '), minimumExperience(row.level), row.entity || 'Dubai', `VL-${slug(row.title).toUpperCase()}`, source, `${row.title}${row.department ? ` — ${row.department}` : ''}`, source, `Experience aligned to ${row.level || 'the source level'} level.`, row.compensation ? `Source compensation: ${row.compensation}` : ''];
  });
  const positionsFile = path.join(outputDir, 'vl-sample-positions.csv');
  const vacanciesFile = path.join(outputDir, 'vl-sample-vacancy-requests.csv');
  fs.writeFileSync(positionsFile, toCsv(positionHeaders, positionRows));
  fs.writeFileSync(vacanciesFile, toCsv(vacancyHeaders, vacancyRows));

  const session = await login();
  const positions = await uploadAndConfirm(session.cookie, 'positions', path.basename(positionsFile), toCsv(positionHeaders, positionRows));
  const vacancyRequests = await uploadAndConfirm(session.cookie, 'vacancy-requests', path.basename(vacanciesFile), toCsv(vacancyHeaders, vacancyRows));
  const requestList = await requestWithCookie(session.cookie, '/vacancy-requests');
  const importedCodes = new Set(vacancyRows.map((row) => String(row[11]).toLowerCase()));
  const importedRequests = (Array.isArray(requestList) ? requestList : []).filter((item) => importedCodes.has(String(item.justification || '').match(/External vacancy code: ([^\n]+)/i)?.[1]?.toLowerCase() || ''));

  const opened = [];
  for (const requestItem of importedRequests) {
    let current = requestItem;
    if (current.status === 'Draft') current = await requestWithCookie(session.cookie, `/vacancy-requests/${current.id}/submit`, { method: 'POST', body: JSON.stringify({ comment: 'Imported from the selected VL.xlsx sample for UAT.' }) });
    while (current.status === 'Pending Approval') current = await requestWithCookie(session.cookie, `/vacancy-requests/${current.id}/approve`, { method: 'POST', body: JSON.stringify({ comment: 'Approved for UAT sample vacancy.' }) });
    const converted = await requestWithCookie(session.cookie, `/vacancy-requests/${current.id}/convert`, { method: 'POST' });
    const vacancy = converted.vacancy;
    const externalCode = String(current.justification || '').match(/External vacancy code:\s*([^\n]+)/i)?.[1]?.trim().toLowerCase();
    const sourceRow = rows.find((row) => externalCode === `VL-${slug(row.title).toUpperCase()}`.toLowerCase());
    if (sourceRow) {
      await requestWithCookie(session.cookie, `/vacancies/${vacancy.id}`, { method: 'PATCH', body: JSON.stringify({ location: sourceRow.entity || 'Dubai', department: sourceRow.department || undefined, requiredSkills: recommendedSkills(sourceRow), minExperienceYears: minimumExperience(sourceRow.level), jobSummary: `${sourceRow.title}${sourceRow.department ? ` — ${sourceRow.department}` : ''}` }) });
    }
    const openedVacancy = await requestWithCookie(session.cookie, `/vacancies/${vacancy.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'Open', reason: 'Ready for CV intake testing.' }) });
    opened.push({ requestCode: current.requestCode, vacancyCode: openedVacancy.vacancyCode, title: openedVacancy.title || sourceRow?.title, vacancyId: openedVacancy.id });
  }

  console.log(JSON.stringify({ source: workbookPath, sampleRows: rows.map((row) => ({ sheet: row.sheetName, row: row.sourceRow, title: row.title, entity: row.entity, headcount: row.headcount })), positionsJobId: positions.jobId, vacancyRequestsJobId: vacancyRequests.jobId, opened }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
