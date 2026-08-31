const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@recruitflow/database');
const XLSX = require('../apps/api/node_modules/xlsx');

const prisma = new PrismaClient();
const port = Number(process.env.RECRUITFLOW_API_PORT || 3012);
const baseUrl = `http://127.0.0.1:${port}/api/v1`;
const unique = Date.now();
const candidateEmail = `bulk.import.${unique}@recruitflow.local`;
const externalVacancyCode = `BULK-VAC-${unique}`;
let adminCookie = '';
const cleanup = { candidateId: null, vacancyRequestId: null, jobIds: [] };

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[PASS] ${message}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), ...(adminCookie ? { Cookie: adminCookie } : {}) },
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

async function upload(path, fileName, buffer) {
  const form = new FormData();
  form.append('file', new Blob([buffer]), fileName);
  return request(path, { method: 'POST', body: form });
}

async function cleanPreviousTestArtifacts() {
  const oldCandidates = await prisma.candidate.findMany({ where: { email: { startsWith: 'bulk.import.' } }, select: { id: true } });
  if (oldCandidates.length) await prisma.candidate.deleteMany({ where: { id: { in: oldCandidates.map((candidate) => candidate.id) } } });
  const oldRequests = await prisma.vacancyRequest.findMany({ where: { justification: { contains: 'External vacancy code: BULK-VAC-' } }, select: { id: true } });
  if (oldRequests.length) await prisma.vacancyRequest.deleteMany({ where: { id: { in: oldRequests.map((request) => request.id) } } });
  await prisma.candidateImportJob.deleteMany({ where: { fileName: { in: ['candidate-database.xlsx', 'vacancy-list.xlsx'] } } });
}

async function main() {
  await cleanPreviousTestArtifacts();
  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ahmed.mahmoud@recruitflow.local', password: 'Password123!' }),
  });
  assert(login.response.status === 200, `Admin login succeeds (${login.response.status})`);
  adminCookie = login.response.headers.get('set-cookie')?.split(';')[0] || '';
  assert(Boolean(adminCookie), 'Admin session cookie is returned');

  const template = await request('/imports/candidates/template');
  assert(template.response.status === 200, 'Candidate template endpoint returns 200');
  assert((template.response.headers.get('content-type') || '').includes('spreadsheetml'), 'Candidate template is an Excel workbook');

  const candidateWorkbook = workbookBuffer('Candidates', [{
    'First Name': 'Bulk',
    'Last Name': `Candidate ${unique}`,
    Email: candidateEmail,
    Phone: '+201000000000',
    'Current Title': 'Recruitment Analyst',
    'Current Company': 'RecruitFlow Test',
    Skills: 'Excel, Recruitment, ATS',
    'Experience Years': 4,
    Location: 'Cairo',
    Source: 'Bulk Excel Test',
    Status: 'Active',
  }]);
  const candidateInspect = await upload('/imports/candidates/inspect', 'candidate-database.xlsx', candidateWorkbook);
  assert(candidateInspect.response.status === 201, `Candidate workbook inspection succeeds (${candidateInspect.response.status})`);
  assert(candidateInspect.body.sheets?.[0]?.rowCount === 1, 'Candidate inspection reports one data row');

  const candidateUpload = await upload('/imports/candidates/upload', 'candidate-database.xlsx', candidateWorkbook);
  assert(candidateUpload.response.status === 201, `Candidate workbook staging succeeds (${candidateUpload.response.status})`);
  cleanup.jobIds.push(candidateUpload.body.jobId);
  const candidateSummary = await request(`/imports/candidates/jobs/${candidateUpload.body.jobId}`);
  assert(candidateSummary.response.status === 200 && candidateSummary.body.validRows === 1, 'Candidate batch is staged with one valid row');
  const candidateConfirm = await request(`/imports/candidates/jobs/${candidateUpload.body.jobId}/confirm`, { method: 'POST' });
  assert(candidateConfirm.response.status === 201 && candidateConfirm.body.newRows === 1, 'Candidate batch confirmation creates one candidate');
  const createdCandidate = await prisma.candidate.findFirst({ where: { email: candidateEmail } });
  assert(Boolean(createdCandidate), 'Imported candidate is persisted in the database');
  cleanup.candidateId = createdCandidate?.id || null;

  const context = await prisma.$transaction(async (tx) => {
    const branch = await tx.branch.findFirst({ where: { organizationId: createdCandidate.organizationId, status: 'Active' } });
    const position = await tx.position.findFirst({ where: { organizationId: createdCandidate.organizationId, status: 'Active' } });
    const user = await tx.user.findUnique({ where: { id: '10000000-0000-4000-8000-000000000004' } });
    return { branch, position, user };
  });
  assert(Boolean(context.branch && context.position && context.user), 'Vacancy import reference data is available');

  const vacancyWorkbook = workbookBuffer('Vacancy Requests', [{
    'Position Code': context.position.code,
    'Branch Code': context.branch.code,
    'Requester Email': context.user.email,
    'Requested Headcount': 2,
    'Employment Type': 'Full-time',
    Criticality: 'High',
    'Target Start Date': '2026-10-01',
    'External Vacancy Code': externalVacancyCode,
    Justification: 'Bulk import verification',
  }]);
  const vacancyInspect = await upload('/imports/vacancy-requests/inspect', 'vacancy-list.xlsx', vacancyWorkbook);
  assert(vacancyInspect.response.status === 201, `Vacancy workbook inspection succeeds (${vacancyInspect.response.status})`);
  const vacancyUpload = await upload('/imports/vacancy-requests/upload', 'vacancy-list.xlsx', vacancyWorkbook);
  assert(vacancyUpload.response.status === 201, `Vacancy workbook staging succeeds (${vacancyUpload.response.status})`);
  cleanup.jobIds.push(vacancyUpload.body.jobId);
  const vacancySummary = await request(`/imports/vacancy-requests/jobs/${vacancyUpload.body.jobId}`);
  assert(vacancySummary.response.status === 200 && vacancySummary.body.validRows === 1, 'Vacancy batch is staged with one valid row');
  const vacancyConfirm = await request(`/imports/vacancy-requests/jobs/${vacancyUpload.body.jobId}/confirm`, { method: 'POST' });
  assert(vacancyConfirm.response.status === 201 && vacancyConfirm.body.newRows === 1, 'Vacancy batch creates one draft request');
  const createdRequest = await prisma.vacancyRequest.findFirst({ where: { organizationId: createdCandidate.organizationId, justification: { contains: externalVacancyCode } } });
  assert(Boolean(createdRequest) && createdRequest.status === 'Draft', 'Imported vacancy remains a draft request pending approval');
  cleanup.vacancyRequestId = createdRequest?.id || null;
}

main()
  .catch((error) => {
    console.error(`[FAIL] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (cleanup.vacancyRequestId) await prisma.vacancyRequest.delete({ where: { id: cleanup.vacancyRequestId } }).catch(() => undefined);
    if (cleanup.candidateId) await prisma.candidate.delete({ where: { id: cleanup.candidateId } }).catch(() => undefined);
    if (cleanup.jobIds.length) await prisma.candidateImportJob.deleteMany({ where: { id: { in: cleanup.jobIds } } }).catch(() => undefined);
    await prisma.$disconnect();
  });
