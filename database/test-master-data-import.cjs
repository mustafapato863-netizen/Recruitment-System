const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@recruitflow/database');
const XLSX = require('../apps/api/node_modules/xlsx');

const prisma = new PrismaClient();
const port = Number(process.env.RECRUITFLOW_API_PORT || 3012);
const baseUrl = `http://127.0.0.1:${port}/api/v1`;
const unique = Date.now();
const entityName = `Bulk Entity ${unique}`;
let adminCookie = '';
const cleanup = { entityId: null, branchId: null, positionId: null, jobIds: [] };

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[PASS] ${message}`);
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { ...(options.headers || {}), ...(adminCookie ? { Cookie: adminCookie } : {}) },
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('json') ? await response.json() : await response.arrayBuffer();
  return { response, body };
}

async function requestWithCookie(pathname, cookie, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { ...(options.headers || {}), ...(cookie ? { Cookie: cookie } : {}) },
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('json') ? await response.json() : await response.arrayBuffer();
  return { response, body };
}

function workbookBuffer(sheetName, rows) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

async function upload(pathname, fileName, buffer) {
  const form = new FormData();
  form.append('file', new Blob([buffer]), fileName);
  return request(pathname, { method: 'POST', body: form });
}

async function main() {
  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ahmed.mahmoud@recruitflow.local', password: 'Password123!' }),
  });
  assert(login.response.status === 200, `Admin login succeeds (${login.response.status})`);
  adminCookie = login.response.headers.get('set-cookie')?.split(';')[0] || '';
  assert(Boolean(adminCookie), 'Admin session cookie is returned');

  const recruiterResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sarah.ahmed@recruitflow.local', password: 'Password123!' }),
  });
  const recruiterCookie = recruiterResponse.headers.get('set-cookie')?.split(';')[0] || '';
  assert(recruiterResponse.status === 200 && Boolean(recruiterCookie), 'Recruiter login succeeds for permission verification');
  const forbiddenUpload = await requestWithCookie('/imports/master-data/legal-entities/upload', recruiterCookie, { method: 'POST' });
  assert(forbiddenUpload.response.status === 403, 'Recruiter cannot stage master-data imports without MASTER_DATA_MANAGE');

  for (const dataset of ['legal-entities', 'branches', 'positions']) {
    const template = await request(`/imports/master-data/${dataset}/template`);
    assert(template.response.status === 200, `${dataset} template endpoint returns 200`);
    assert((template.response.headers.get('content-type') || '').includes('spreadsheetml'), `${dataset} template is an Excel workbook`);
  }

  const legalWorkbook = workbookBuffer('Legal Entities', [
    { Name: entityName, Status: 'Active' },
    { Code: `BAD-${unique}`, Status: 'Active' },
  ]);
  const inspected = await upload('/imports/master-data/legal-entities/inspect', 'master-data-legal-entities.xlsx', legalWorkbook);
  assert(inspected.response.status === 201 && inspected.body.sheets?.[0]?.rowCount === 2, 'Legal-entity workbook inspection reports both rows');
  const staged = await upload('/imports/master-data/legal-entities/upload', `master-data-legal-entities-${unique}.xlsx`, legalWorkbook);
  assert(staged.response.status === 201, `Legal-entity workbook staging succeeds (${staged.response.status})`);
  cleanup.jobIds.push(staged.body.jobId);
  const tarekResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tarek.kamal@acme-health.local', password: 'Password123!' }),
  });
  const tarekCookie = tarekResponse.headers.get('set-cookie')?.split(';')[0] || '';
  assert(tarekResponse.status === 200 && Boolean(tarekCookie), 'Second-tenant login succeeds for isolation verification');
  const crossTenant = await requestWithCookie(`/imports/master-data/legal-entities/jobs/${staged.body.jobId}`, tarekCookie);
  assert(crossTenant.response.status === 404, 'A second tenant cannot read the first tenant import job');
  const summary = await request(`/imports/master-data/legal-entities/jobs/${staged.body.jobId}`);
  assert(summary.response.status === 200 && summary.body.validRows === 1 && summary.body.invalidRows === 1, 'Required-field validation separates valid and invalid legal-entity rows');
  const errorReport = await request(`/imports/master-data/legal-entities/jobs/${staged.body.jobId}/error-report`);
  assert(errorReport.response.status === 200 && (errorReport.response.headers.get('content-type') || '').includes('spreadsheetml') && errorReport.body.byteLength > 100, 'Master-data error report downloads as XLSX');
  const confirmed = await request(`/imports/master-data/legal-entities/jobs/${staged.body.jobId}/confirm`, { method: 'POST' });
  assert(confirmed.response.status === 201 && confirmed.body.newRows === 1, 'Legal-entity confirmation creates only valid rows');
  const entity = await prisma.legalEntity.findFirst({ where: { name: entityName }, select: { id: true, organizationId: true, code: true } });
  assert(Boolean(entity) && /^LE-\d{4}$/.test(entity?.code || ''), 'Omitted legal-entity code is generated by the locked resolver');
  cleanup.entityId = entity?.id || null;

  const duplicateWorkbook = workbookBuffer('Legal Entities', [{ Code: entity.code, Name: `${entityName} Updated`, Status: 'Active' }]);
  const duplicate = await upload('/imports/master-data/legal-entities/upload', `master-data-duplicate-${unique}.xlsx`, duplicateWorkbook);
  assert(duplicate.response.status === 201, 'Duplicate legal-entity workbook stages successfully');
  cleanup.jobIds.push(duplicate.body.jobId);
  const duplicateSummary = await request(`/imports/master-data/legal-entities/jobs/${duplicate.body.jobId}`);
  assert(duplicateSummary.body.duplicateRows === 1 && duplicateSummary.body.unresolvedDuplicateRows === 1, 'Duplicate summary exposes an unresolved recruiter decision');
  const duplicateRows = await request(`/imports/master-data/legal-entities/jobs/${duplicate.body.jobId}/rows?page=1&pageSize=10`);
  const duplicateRow = duplicateRows.body.rows?.[0];
  assert(Boolean(duplicateRow?.id), 'Duplicate row is available for an explicit decision');
  const skipped = await request(`/imports/master-data/legal-entities/jobs/${duplicate.body.jobId}/rows/${duplicateRow.id}/decision/Skip`, { method: 'POST' });
  assert(skipped.response.status === 201, 'Duplicate row can be explicitly skipped');
  const skippedSummary = await request(`/imports/master-data/legal-entities/jobs/${duplicate.body.jobId}`);
  assert(skippedSummary.body.unresolvedDuplicateRows === 0, 'Skipping the duplicate clears the confirmation gate');
  const duplicateConfirm = await request(`/imports/master-data/legal-entities/jobs/${duplicate.body.jobId}/confirm`, { method: 'POST' });
  assert(duplicateConfirm.response.status === 201 && duplicateConfirm.body.skippedRows === 1, 'Skipped duplicate is not imported or used to overwrite data');

  const branchWorkbook = workbookBuffer('Branches', [{ Name: `Bulk Branch ${unique}`, Country: 'EGY', City: 'Offshore', Status: 'Active' }]);
  const branchUpload = await upload('/imports/master-data/branches/upload', `master-data-branches-${unique}.xlsx`, branchWorkbook);
  assert(branchUpload.response.status === 201, 'Branch workbook staging succeeds');
  cleanup.jobIds.push(branchUpload.body.jobId);
  const branchSummary = await request(`/imports/master-data/branches/jobs/${branchUpload.body.jobId}`);
  assert(branchSummary.body.validRows === 1 && branchSummary.body.invalidRows === 0, 'Branch workbook validates country and city without a legal-entity link');
  const branchConfirm = await request(`/imports/master-data/branches/jobs/${branchUpload.body.jobId}/confirm`, { method: 'POST' });
  assert(branchConfirm.response.status === 201 && branchConfirm.body.newRows === 1, 'Branch confirmation creates the staged branch');
  const branch = await prisma.branch.findFirst({ where: { name: `Bulk Branch ${unique}` }, select: { id: true, code: true } });
  assert(Boolean(branch) && /^BR-\d{4}$/.test(branch?.code || ''), 'Omitted branch code is generated automatically');
  cleanup.branchId = branch?.id || null;

  const positionWorkbook = workbookBuffer('Positions', [{ 'Legal Entity Code': entity.code, Title: `Bulk Position ${unique}`, Description: 'Master-data import test', Status: 'Active' }]);
  const positionUpload = await upload('/imports/master-data/positions/upload', `master-data-positions-${unique}.xlsx`, positionWorkbook);
  assert(positionUpload.response.status === 201, 'Position workbook staging succeeds');
  cleanup.jobIds.push(positionUpload.body.jobId);
  const positionSummary = await request(`/imports/master-data/positions/jobs/${positionUpload.body.jobId}`);
  assert(positionSummary.body.validRows === 1 && positionSummary.body.invalidRows === 0, 'Position workbook resolves its optional legal-entity foreign key');
  const positionConfirm = await request(`/imports/master-data/positions/jobs/${positionUpload.body.jobId}/confirm`, { method: 'POST' });
  assert(positionConfirm.response.status === 201 && positionConfirm.body.newRows === 1, 'Position confirmation creates the staged position');
  const position = await prisma.position.findFirst({ where: { title: `Bulk Position ${unique}` }, select: { id: true, code: true } });
  assert(Boolean(position) && /^POS-\d{4}$/.test(position?.code || ''), 'Omitted position code is generated automatically');
  cleanup.positionId = position?.id || null;
}

main()
  .catch((error) => {
    console.error(`[FAIL] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (cleanup.positionId) await prisma.position.delete({ where: { id: cleanup.positionId } }).catch(() => undefined);
    if (cleanup.branchId) await prisma.branch.delete({ where: { id: cleanup.branchId } }).catch(() => undefined);
    if (cleanup.entityId) await prisma.legalEntity.delete({ where: { id: cleanup.entityId } }).catch(() => undefined);
    if (cleanup.jobIds.length) await prisma.candidateImportJob.deleteMany({ where: { id: { in: cleanup.jobIds } } }).catch(() => undefined);
    await prisma.$disconnect();
  });
