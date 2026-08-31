const path = require('node:path');
const fs = require('node:fs/promises');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@recruitflow/database');

const prisma = new PrismaClient();
const port = Number(process.env.RECRUITFLOW_API_PORT || 3012);
const baseUrl = `http://127.0.0.1:${port}/api/v1`;
const unique = Date.now();
let cookie = '';
const cleanup = { positionIds: [], branchIds: [], templateId: null, stageId: null, documentId: null, documentStorageKey: null };

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[PASS] ${message}`);
}

async function request(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers: { ...(options.headers || {}), ...(cookie ? { Cookie: cookie } : {}) },
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('json') ? await response.json() : await response.arrayBuffer();
  return { response, body };
}

async function main() {
  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ahmed.mahmoud@recruitflow.local', password: 'Password123!' }),
  });
  assert(login.response.status === 200, `Admin login succeeds (${login.response.status})`);
  cookie = login.response.headers.get('set-cookie')?.split(';')[0] || '';
  assert(Boolean(cookie), 'Admin session cookie is returned');

  const imports = await request('/imports/candidates/jobs?page=1&pageSize=8');
  assert(imports.response.status === 200, 'Current bulk-import history route is registered');

  const report = await request('/reports/export.xlsx?from=2026-01-01&to=2026-12-31');
  assert(report.response.status === 200, 'Reports Excel export returns 200');
  assert((report.response.headers.get('content-type') || '').includes('spreadsheetml'), 'Reports export is an Excel workbook');
  assert(report.body.byteLength > 100, 'Reports workbook contains data');

  const organizationId = login.body.user.organizationId;
  const positionOne = await request('/positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `Auto ID Position ${unique}` }),
  });
  const positionTwo = await request('/positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `Auto ID Position ${unique} Two` }),
  });
  assert(positionOne.response.status === 201 && positionTwo.response.status === 201, 'Master-data positions accept omitted codes');
  cleanup.positionIds.push(positionOne.body.id, positionTwo.body.id);
  assert(/^POS-\d{4,}$/.test(positionOne.body.code) && /^POS-\d{4,}$/.test(positionTwo.body.code), 'Position codes are generated automatically');
  assert(positionOne.body.code !== positionTwo.body.code, 'Generated position codes remain unique');

  const template = await request('/pipeline-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Hardening Pipeline ${unique}`, isDefault: false }),
  });
  assert(template.response.status === 201, 'Pipeline template can be created');
  cleanup.templateId = template.body.id;
  const stage = await request(`/pipeline-templates/${cleanup.templateId}/stages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Review', stageType: 'Screening', slaDays: 3 }),
  });
  assert(stage.response.status === 201, 'Pipeline stage can be created');
  cleanup.stageId = stage.body.id;
  const secondStage = await request(`/pipeline-templates/${cleanup.templateId}/stages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Interview', stageType: 'Interview', slaDays: 5 }),
  });
  assert(secondStage.response.status === 201, 'Second pipeline stage can be created');
  const stageToArchive = secondStage.body.id;
  const updateTemplate = await request(`/pipeline-templates/${cleanup.templateId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `Updated Pipeline ${unique}` }),
  });
  assert(updateTemplate.response.status === 200 && updateTemplate.body.name.includes('Updated'), 'Pipeline template can be edited');
  const archiveStage = await request(`/pipeline-templates/${cleanup.templateId}/stages/${stageToArchive}`, { method: 'DELETE' });
  assert(archiveStage.response.status === 200 && archiveStage.body.status === 'Archived', `Pipeline stages can be archived safely (${archiveStage.response.status}, ${JSON.stringify(archiveStage.body)})`);
  cleanup.stageId = null;
  const archiveTemplate = await request(`/pipeline-templates/${cleanup.templateId}`, { method: 'DELETE' });
  assert(archiveTemplate.response.status === 200 && archiveTemplate.body.status === 'Archived', 'Pipeline templates can be archived safely');

  const cvBank = await request('/documents/cv-bank?page=1&pageSize=10');
  assert(cvBank.response.status === 200 && Array.isArray(cvBank.body.data), 'CV Bank list returns paginated data');
  const manifest = await request('/documents/cv-bank/manifest.xlsx');
  assert(manifest.response.status === 200 && (manifest.response.headers.get('content-type') || '').includes('spreadsheetml'), 'CV Bank backup manifest is Excel');

  const candidate = await prisma.candidate.findFirst({ where: { organizationId }, select: { id: true } });
  assert(Boolean(candidate), 'A candidate exists for CV Bank file verification');
  const form = new FormData();
  form.append('candidateId', candidate.id);
  form.append('documentType', 'CV');
  form.append('file', new Blob([Buffer.from('%PDF-1.4 RecruitFlow test CV')], { type: 'application/pdf' }), `hardening-${unique}.pdf`);
  const uploaded = await request('/documents/upload', { method: 'POST', body: form });
  assert(uploaded.response.status === 201 && uploaded.body.hasFile === true, `CV file upload stores a protected file (${uploaded.response.status}, ${JSON.stringify(uploaded.body)})`);
  const stored = await prisma.candidateDocument.findUnique({ where: { id: uploaded.body.id }, select: { storageKey: true } });
  cleanup.documentId = uploaded.body.id;
  cleanup.documentStorageKey = stored?.storageKey || null;
  const downloaded = await request(`/documents/${cleanup.documentId}/download`);
  assert(downloaded.response.status === 200 && downloaded.body.byteLength > 10, 'Stored CV file can be downloaded through the API');
}

main()
  .catch((error) => {
    console.error(`[FAIL] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (cleanup.documentId) await prisma.candidateDocument.delete({ where: { id: cleanup.documentId } }).catch(() => undefined);
    if (cleanup.documentStorageKey) {
      const root = path.resolve(process.env.RECRUITFLOW_DOCUMENT_STORAGE_PATH || path.join(process.cwd(), 'storage', 'documents'));
      await fs.unlink(path.resolve(root, cleanup.documentStorageKey)).catch(() => undefined);
    }
    if (cleanup.stageId) await prisma.pipelineStage.delete({ where: { id: cleanup.stageId } }).catch(() => undefined);
    if (cleanup.templateId) {
      await prisma.pipelineStage.deleteMany({ where: { templateId: cleanup.templateId } }).catch(() => undefined);
      await prisma.pipelineTemplate.delete({ where: { id: cleanup.templateId } }).catch(() => undefined);
    }
    if (cleanup.branchIds.length) await prisma.branch.deleteMany({ where: { id: { in: cleanup.branchIds } } }).catch(() => undefined);
    if (cleanup.positionIds.length) await prisma.position.deleteMany({ where: { id: { in: cleanup.positionIds } } }).catch(() => undefined);
    await prisma.$disconnect();
  });
