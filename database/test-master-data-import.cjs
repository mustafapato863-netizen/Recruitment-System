const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@recruitflow/database');
const XLSX = require('../apps/api/node_modules/xlsx');

const prisma = new PrismaClient();
const port = Number(process.env.RECRUITFLOW_API_PORT || 3012);
const baseUrl = `http://127.0.0.1:${port}/api/v1`;
const unique = Date.now();
let adminCookie = '';
const cleanup = { branchId: null, positionId: null, jobIds: [] };

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
  const forbiddenUpload = await requestWithCookie('/imports/master-data/branches/upload', recruiterCookie, { method: 'POST' });
  assert(forbiddenUpload.response.status === 403, 'Recruiter cannot stage master-data imports without MASTER_DATA_MANAGE');

  for (const dataset of ['branches', 'positions']) {
    const template = await request(`/imports/master-data/${dataset}/template`);
    assert(template.response.status === 200, `${dataset} template endpoint returns 200`);
    assert((template.response.headers.get('content-type') || '').includes('spreadsheetml'), `${dataset} template is an Excel workbook`);
  }

  const branchWorkbook = workbookBuffer('Branches', [{ Name: `Bulk Branch ${unique}`, Country: 'EGY', City: 'Cairo', Status: 'Active' }]);
  const branchUpload = await upload('/imports/master-data/branches/upload', `master-data-branches-${unique}.xlsx`, branchWorkbook);
  assert(branchUpload.response.status === 201, 'Branch workbook staging succeeds');
  cleanup.jobIds.push(branchUpload.body.jobId);
  const tarekResponse = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tarek.kamal@acme-health.local', password: 'Password123!' }),
  });
  const tarekCookie = tarekResponse.headers.get('set-cookie')?.split(';')[0] || '';
  assert(tarekResponse.status === 200 && Boolean(tarekCookie), 'Second-tenant login succeeds for isolation verification');
  const crossTenant = await requestWithCookie(`/imports/master-data/branches/jobs/${branchUpload.body.jobId}`, tarekCookie);
  assert(crossTenant.response.status === 404, 'A second tenant cannot read the first tenant import job');
  const branchSummary = await request(`/imports/master-data/branches/jobs/${branchUpload.body.jobId}`);
  assert(branchSummary.body.validRows === 1 && branchSummary.body.invalidRows === 0, 'Branch workbook validates country and city directly for the organization');
  const branchConfirm = await request(`/imports/master-data/branches/jobs/${branchUpload.body.jobId}/confirm`, { method: 'POST' });
  assert(branchConfirm.response.status === 201 && branchConfirm.body.newRows === 1, 'Branch confirmation creates the staged branch');
  const branch = await prisma.branch.findFirst({ where: { name: `Bulk Branch ${unique}` }, select: { id: true, code: true } });
  assert(Boolean(branch) && /^BR-\d{4}$/.test(branch?.code || ''), 'Omitted branch code is generated automatically');
  cleanup.branchId = branch?.id || null;

  const positionWorkbook = workbookBuffer('Positions', [{ Title: `Bulk Position ${unique}`, Description: 'Master-data import test', Status: 'Active' }]);
  const positionUpload = await upload('/imports/master-data/positions/upload', `master-data-positions-${unique}.xlsx`, positionWorkbook);
  assert(positionUpload.response.status === 201, 'Position workbook staging succeeds');
  cleanup.jobIds.push(positionUpload.body.jobId);
  const positionSummary = await request(`/imports/master-data/positions/jobs/${positionUpload.body.jobId}`);
  assert(positionSummary.body.validRows === 1 && positionSummary.body.invalidRows === 0, 'Position workbook validates without an organization intermediary');
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
    if (cleanup.jobIds.length) await prisma.candidateImportJob.deleteMany({ where: { id: { in: cleanup.jobIds } } }).catch(() => undefined);
    await prisma.$disconnect();
  });
