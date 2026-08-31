const path = require('node:path');
const fs = require('node:fs/promises');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@recruitflow/database');

const prisma = new PrismaClient();
const port = Number(process.env.RECRUITFLOW_API_PORT || 3012);
const baseUrl = `http://127.0.0.1:${port}/api/v1`;
const unique = Date.now();
const cleanup = { documentIds: [], storageKeys: [] };

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[PASS] ${message}`);
}

async function request(route, options = {}, sessionCookie = '') {
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers: { ...(options.headers || {}), ...(sessionCookie ? { Cookie: sessionCookie } : {}) },
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('json') ? await response.json() : await response.arrayBuffer();
  return { response, body };
}

async function login(email) {
  const result = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!' }),
  });
  assert(result.response.status === 200, `${email} login succeeds`);
  return {
    cookie: result.response.headers.get('set-cookie')?.split(';')[0] || '',
    user: result.body.user,
  };
}

function formFor(candidateId, file, fileName) {
  const form = new FormData();
  form.append('candidateId', candidateId);
  form.append('documentType', 'CV');
  form.append('file', new Blob([file], { type: 'application/pdf' }), fileName);
  return form;
}

async function main() {
  const anonymousStatus = await request('/documents/cv-bank/backup-status');
  assert(anonymousStatus.response.status === 401, 'Anonymous CV backup-status access is denied');
  const admin = await login('ahmed.mahmoud@recruitflow.local');
  const organizationId = admin.user.organizationId;
  const candidate = await prisma.candidate.findFirst({ where: { organizationId }, select: { id: true } });
  assert(Boolean(candidate), 'An organization-scoped candidate exists for CV storage tests');

  const validPdf = Buffer.from('%PDF-1.4 RecruitFlow CV storage test');
  const uploaded = await request('/documents/upload', {
    method: 'POST',
    body: formFor(candidate.id, validPdf, `storage-${unique}.pdf`),
  }, admin.cookie);
  assert(uploaded.response.status === 201, `Clean CV upload returns 201 (${uploaded.response.status})`);
  assert(uploaded.body.scanStatus === 'Clean' && uploaded.body.hasFile === true, 'Clean CV is scan-approved and stored');
  assert(/^[a-f0-9]{64}$/.test(uploaded.body.sha256 || ''), 'Stored CV exposes a SHA-256 integrity hash');
  assert(uploaded.body.storageKey === undefined, 'Private storage keys are not exposed to clients');
  cleanup.documentIds.push(uploaded.body.id);
  const stored = await prisma.candidateDocument.findUnique({ where: { id: uploaded.body.id }, select: { storageKey: true } });
  if (stored?.storageKey && !stored.storageKey.startsWith('metadata-only/')) cleanup.storageKeys.push(stored.storageKey);

  const download = await request(`/documents/${uploaded.body.id}/download`, {}, admin.cookie);
  assert(download.response.status === 200 && download.body.byteLength === validPdf.length, 'Clean stored CV can be downloaded');

  const eicar = Buffer.concat([Buffer.from('%PDF-1.4 '), Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')]);
  const rejected = await request('/documents/upload', {
    method: 'POST',
    body: formFor(candidate.id, eicar, `rejected-${unique}.pdf`),
  }, admin.cookie);
  assert(rejected.response.status === 201, 'Rejected CV upload is recorded for audit review');
  assert(rejected.body.scanStatus === 'Rejected' && rejected.body.hasFile === false, 'Rejected CV is never stored as a downloadable binary');
  cleanup.documentIds.push(rejected.body.id);
  const rejectedDownload = await request(`/documents/${rejected.body.id}/download`, {}, admin.cookie);
  assert(rejectedDownload.response.status === 404, 'Rejected CV download is blocked');

  const status = await request('/documents/cv-bank/backup-status', {}, admin.cookie);
  assert(status.response.status === 200, 'CV backup readiness endpoint is available');
  assert(status.body.manifestOnly === true && status.body.storageProvider, 'Backup status honestly identifies manifest-only export and storage provider');

  const manifest = await request('/documents/cv-bank/backup-manifest.xlsx', {}, admin.cookie);
  assert(manifest.response.status === 200 && (manifest.response.headers.get('content-type') || '').includes('spreadsheetml'), 'CV backup manifest alias returns an Excel workbook');
  assert(manifest.body.byteLength > 100, 'CV backup manifest contains workbook data');

  const expired = await request(`/documents/${uploaded.body.id}/retention`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consentStatus: 'Expired', retentionExpiresAt: new Date(Date.now() - 60_000).toISOString() }),
  }, admin.cookie);
  assert(expired.response.status === 200 && expired.body.consentStatus === 'Expired', 'Retention and consent state can be updated');
  const expiredDownload = await request(`/documents/${uploaded.body.id}/download`, {}, admin.cookie);
  assert(expiredDownload.response.status === 404, 'Expired CV download is blocked');
  const restoredRetention = await request(`/documents/${uploaded.body.id}/retention`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consentStatus: 'Active', retentionExpiresAt: null }),
  }, admin.cookie);
  assert(restoredRetention.response.status === 200 && restoredRetention.body.consentStatus === 'Active', 'Active consent and cleared retention restore controlled access');

  const archived = await request(`/documents/${uploaded.body.id}/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'CV storage hardening test archive' }),
  }, admin.cookie);
  assert(archived.response.status === 201 && archived.body.deletedAt, 'CV archive is soft-delete and audited');
  const archivedGet = await request(`/documents/${uploaded.body.id}`, {}, admin.cookie);
  assert(archivedGet.response.status === 404, 'Archived CV is hidden from active document access');
  const restored = await request(`/documents/${uploaded.body.id}/restore`, { method: 'POST' }, admin.cookie);
  assert(restored.response.status === 201 && restored.body.deletedAt === null, 'Archived CV can be restored without deleting its binary');

  const otherTenant = await login('tarek.kamal@acme-health.local');
  const crossTenant = await request(`/documents/${uploaded.body.id}`, {}, otherTenant.cookie);
  assert(crossTenant.response.status === 404, 'Cross-tenant CV access returns not found');
  const crossTenantDownload = await request(`/documents/${uploaded.body.id}/download`, {}, otherTenant.cookie);
  assert(crossTenantDownload.response.status === 404, 'Cross-tenant CV download returns not found');

  console.log('[PASS] CV storage hardening suite complete');
}

main()
  .catch((error) => {
    console.error(`[FAIL] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    const root = path.resolve(process.env.RECRUITFLOW_DOCUMENT_STORAGE_PATH || path.join(process.cwd(), 'storage', 'documents'));
    for (const id of cleanup.documentIds) await prisma.candidateDocument.delete({ where: { id } }).catch(() => undefined);
    for (const storageKey of cleanup.storageKeys) {
      if (storageKey.includes('..') || storageKey.includes('\\') || path.isAbsolute(storageKey)) continue;
      await fs.unlink(path.resolve(root, storageKey)).catch(() => undefined);
    }
    await prisma.$disconnect();
  });
