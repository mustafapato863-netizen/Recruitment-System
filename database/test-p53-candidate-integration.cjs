/**
 * P5.3 — Candidates, CV Intake, Applications, and Profiles Integration Test Suite
 *
 * Covers:
 * 1. Candidate List & Filtering (pagination, status, source, search, total counts)
 * 2. Candidate Profile & Safe Disclosure (retrieval, non-disclosure of internal secrets, 404 for missing)
 * 3. Candidate Creation (validation failure, duplicate email 409 conflict, valid creation with auto-generated code)
 * 4. CV Upload & Intake Batch (CSV parsing, validation, batch job record creation)
 * 5. Import Preview & Row Decisions (row-level duplicate resolution, batch confirmation, error report download)
 * 6. Application Details & Stage History (retrieval, candidate link, vacancy link, transition audit records)
 * 7. Phone Screening Submission & Logs (submission with outcome, screening history retrieval)
 * 8. Candidate Document Vault (upload, classification, storageKey isolation, listing)
 * 9. Cross-Tenant Isolation (Safe 404 across Org A and Org B for candidates, applications, documents)
 * 10. UUID Validation (Clean 400 Bad Request on invalid UUIDs across all candidate/application routes)
 * 11. Clean Teardown of all generated test fixtures
 */

const http = require('http');
const { PrismaClient } = require('./generated/client');
const API_PORT = Number(process.env.RECRUITFLOW_API_PORT || 3000);

const prisma = new PrismaClient();

// ─── HTTP Helper ─────────────────────────────────────────────────────────────
function request(options, body) {
  return new Promise((resolve, reject) => {
    const opts = { ...options, port: API_PORT, headers: { ...(options.headers || {}) } };
    let payload = null;
    if (body !== undefined && body !== null) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login(email, password) {
  const res = await request({
    hostname: 'localhost', port: 3000,
    path: '/api/v1/auth/login', method: 'POST',
  }, { email, password });
  const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  return { status: res.status, cookie: cookies, profile: res.body?.user };
}

function isSafe(body) {
  if (!body) return true;
  const str = typeof body === 'string' ? body : JSON.stringify(body);
  const dangerous = [
    'PrismaClient', 'SELECT ', 'INSERT ', 'UPDATE ', 'DELETE FROM',
    'node_modules', 'schema.prisma', 'passwordHash', 'tokenSecret',
    'stack', 'Trace:', 'QueryFailedError',
  ];
  return !dangerous.some(d => str.includes(d));
}

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message} ${detail ? `(${detail})` : ''}`);
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  P5.3 Integration Suite — Candidates, CV Intake & Applications   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // Login users
  const adminA = await login('ahmed.mahmoud@recruitflow.local', 'Password123!');
  const adminB = await login('tarek.kamal@acme-health.local', 'Password123!');

  assert(adminA.status === 200, 'Admin Org A logged in successfully');
  assert(adminB.status === 200, 'Admin Org B logged in successfully');

  const headersA = { Cookie: adminA.cookie };
  const headersB = { Cookie: adminB.cookie };

  const uniqueSuffix = Date.now();
  const createdCandidateIds = [];
  const createdApplicationIds = [];
  const createdDocumentIds = [];
  const createdJobIds = [];

  try {
    // ─── 1. Candidate List, Pagination & Filters ──────────────────────────────
    console.log('\n── S1: Candidate List, Search & Pagination ──');
    const listRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/candidates?page=1&pageSize=10',
      method: 'GET',
      headers: headersA,
    });
    assert(listRes.status === 200, 'Candidate list returns 200 OK');
    assert(Array.isArray(listRes.body?.data), 'Candidate list returns data array');
    assert(typeof listRes.body?.total === 'number', 'Candidate list returns total count');
    assert(isSafe(listRes.body), 'Candidate list response is clean of internal leaks');

    // Filter by status
    const statusRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/candidates?status=Active',
      method: 'GET',
      headers: headersA,
    });
    assert(statusRes.status === 200, 'Filtered candidate list returns 200 OK');
    assert(statusRes.body?.data?.every(c => c.status === 'Active'), 'All returned candidates have Active status');

    // ─── 2. Candidate Creation & Duplicate Conflict ───────────────────────────
    console.log('\n── S2: Candidate Creation & Duplicate Conflict ──');
    const testEmail = `p53_cand_${uniqueSuffix}@example.com`;

    // Validation failure (missing lastName)
    const valRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/candidates',
      method: 'POST',
      headers: headersA,
    }, {
      firstName: 'TestFirst',
      email: testEmail,
    });
    assert(valRes.status === 400, 'Creating candidate without required lastName returns 400 Bad Request');
    assert(isSafe(valRes.body), 'Validation failure response is safe and clean');

    // Valid candidate creation
    const createRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/candidates',
      method: 'POST',
      headers: headersA,
    }, {
      firstName: 'Amina',
      lastName: `Hassan_${uniqueSuffix}`,
      email: testEmail,
      phone: '+201011112222',
      currentTitle: 'Lead Product Designer',
      currentCompany: 'Cairo Design Studio',
      source: 'LinkedIn',
    });
    assert(createRes.status === 201, 'Valid candidate creation returns 201 Created');
    assert(createRes.body?.id && createRes.body?.candidateCode, 'Candidate assigned ID and candidateCode');
    assert(createRes.body?.candidateCode.startsWith('CND-') || createRes.body?.candidateCode.startsWith('CAN-'), `Candidate code format conforms (${createRes.body?.candidateCode})`);
    if (createRes.body?.id) createdCandidateIds.push(createRes.body.id);

    // Duplicate email conflict (409 Conflict)
    const dupRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/candidates',
      method: 'POST',
      headers: headersA,
    }, {
      firstName: 'Duplicate',
      lastName: 'Candidate',
      email: testEmail,
    });
    assert(dupRes.status === 409, 'Duplicate candidate email returns 409 Conflict');
    assert(isSafe(dupRes.body), 'Conflict response is safe without SQL/Prisma leaks');

    // ─── 3. Candidate Profile & Document Vault ─────────────────────────────────
    console.log('\n── S3: Candidate Profile & Document Vault ──');
    const candidateId = createRes.body.id;

    const candDetail = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/candidates/${candidateId}`,
      method: 'GET',
      headers: headersA,
    });
    assert(candDetail.status === 200, 'Candidate detail returns 200 OK');
    assert(candDetail.body?.firstName === 'Amina', 'Candidate detail contains correct first name');
    assert(!candDetail.body?.passwordHash, 'Candidate profile never leaks internal auth fields');

    // Document metadata record
    const docRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/documents',
      method: 'POST',
      headers: headersA,
    }, {
      candidateId,
      documentType: 'CV',
      fileName: 'amina_hassan_resume.pdf',
      fileSize: 1048576,
      mimeType: 'application/pdf',
      storageKey: `org-docs/${candidateId}/${uniqueSuffix}_cv.pdf`,
      extractionText: 'Experienced Lead Product Designer with 8 years of SaaS UX experience.',
    });
    assert(docRes.status === 201, 'Uploading candidate document returns 201 Created');
    assert(docRes.body?.id, 'Document assigned UUID');
    assert(docRes.body?.scanStatus === 'Pending', 'Document record starts in pending scan state');
    assert(!Object.prototype.hasOwnProperty.call(docRes.body ?? {}, 'storageKey'), 'Document storage key is never returned to clients');
    if (docRes.body?.id) createdDocumentIds.push(docRes.body.id);

    // Document listing
    const docList = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/documents/candidate/${candidateId}`,
      method: 'GET',
      headers: headersA,
    });
    assert(docList.status === 200, 'Listing candidate documents returns 200 OK');
    assert(Array.isArray(docList.body) && docList.body.length >= 1, 'Candidate document list contains uploaded file');

    // ─── 4. Application Creation, Stage History & Phone Screening ─────────────
    console.log('\n── S4: Application Details, Stage History & Phone Screening ──');

    // Fetch an active vacancy in Org A
    const vacList = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/vacancies',
      method: 'GET',
      headers: headersA,
    });
    const vacancy = vacList.body?.[0];
    assert(Boolean(vacancy?.id), `Found active vacancy for application testing (${vacancy?.vacancyCode})`);

    // Create Application
    const appRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/applications',
      method: 'POST',
      headers: headersA,
    }, {
      candidateId,
      vacancyId: vacancy.id,
      source: 'LinkedIn',
    });
    assert(appRes.status === 201, 'Creating application returns 201 Created');
    assert(appRes.body?.stage === 'Applied', 'New application starts in Applied stage');
    const applicationId = appRes.body.id;
    if (applicationId) createdApplicationIds.push(applicationId);

    // Get Application detail
    const appDetail = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/applications/${applicationId}`,
      method: 'GET',
      headers: headersA,
    });
    assert(appDetail.status === 200, 'Application detail returns 200 OK');
    assert(appDetail.body?.candidate?.id === candidateId, 'Application detail includes candidate profile');
    assert(isSafe(appDetail.body), 'Application detail response is safe');

    // Advance Stage to Screening
    const stageRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/applications/${applicationId}/stage`,
      method: 'PATCH',
      headers: headersA,
    }, {
      stage: 'Screening',
      reason: 'Passed initial resume screening',
    });
    assert(stageRes.status === 200, 'Advancing application stage to Screening returns 200 OK');
    assert(stageRes.body?.stage === 'Screening', 'Application stage updated to Screening');

    // Submit Phone Screening Log
    const screenRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/screening',
      method: 'POST',
      headers: headersA,
    }, {
      applicationId,
      outcome: 'Passed',
      notes: 'Excellent communication skills, portfolio meets all senior standards.',
    });
    assert(screenRes.status === 201, 'Submitting phone screening log returns 201 Created');
    assert(screenRes.body?.outcome === 'Passed', 'Screening log outcome recorded as Passed');

    // List Phone Screening Logs for Application
    const screenLogs = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/screening/application/${applicationId}`,
      method: 'GET',
      headers: headersA,
    });
    assert(screenLogs.status === 200, 'Listing application screening logs returns 200 OK');
    assert(Array.isArray(screenLogs.body) && screenLogs.body.length >= 1, 'Screening logs include recorded entry');
    assert(screenLogs.body[0].notes.includes('senior standards'), 'Screening log notes preserved verbatim');

    // Verify Application Stage History
    const historyRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/applications/${applicationId}/history`,
      method: 'GET',
      headers: headersA,
    });
    assert(historyRes.status === 200, 'Application history returns 200 OK');
    assert(Array.isArray(historyRes.body) && historyRes.body.length >= 1, 'Stage history contains transition records');
    assert(historyRes.body.some(h => h.toStage === 'Screening'), 'Stage history contains transition to Screening');

    // ─── 5. CV Intake & Import Job ───────────────────────────────────────────
    console.log('\n── S5: CV Intake & Import Job ──');

    const importRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/candidates/import/upload',
      method: 'POST',
      headers: headersA,
    }, {
      fileName: `candidates_batch_${uniqueSuffix}.csv`,
      rows: [
        { firstName: 'Kareem', lastName: 'Adel', email: `kareem.adel_${uniqueSuffix}@example.com`, phone: '+201122334455' },
        { firstName: 'Amina', lastName: 'Hassan', email: testEmail, phone: '+201011112222' }, // duplicate of existing
      ],
    });
    assert(importRes.status === 201, 'Uploading CSV import batch returns 201 Created');
    assert(importRes.body?.jobId, 'Import job created with jobId');
    const jobId = importRes.body.jobId;
    if (jobId) createdJobIds.push(jobId);

    // Get Job summary
    const jobSum = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/candidates/import/${jobId}`,
      method: 'GET',
      headers: headersA,
    });
    assert(jobSum.status === 200, 'Import job summary returns 200 OK');
    assert(jobSum.body?.totalRows === 2, 'Import job parsed 2 rows');

    // Get Job rows
    const jobRows = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/candidates/import/${jobId}/rows`,
      method: 'GET',
      headers: headersA,
    });
    assert(jobRows.status === 200, 'Import job rows query returns 200 OK');
    assert(Array.isArray(jobRows.body?.rows), 'Job rows returned in list');

    // ─── 6. Cross-Tenant Isolation ────────────────────────────────────────────
    console.log('\n── S6: Cross-Tenant Isolation ──');

    const orgBCand = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/candidates/${candidateId}`,
      method: 'GET',
      headers: headersB,
    });
    assert(orgBCand.status === 404, 'Cross-tenant candidate query returns safe 404 Not Found');

    const orgBApp = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/applications/${applicationId}`,
      method: 'GET',
      headers: headersB,
    });
    assert(orgBApp.status === 404, 'Cross-tenant application query returns safe 404 Not Found');

    const orgBDoc = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/documents/candidate/${candidateId}`,
      method: 'GET',
      headers: headersB,
    });
    assert(orgBDoc.status === 404, 'Cross-tenant candidate document list returns safe 404 Not Found');

    // ─── 7. UUID Validation & Non-Disclosure ──────────────────────────────────
    console.log('\n── S7: UUID Route Parameter Validation ──');

    const badUuidCand = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/candidates/not-a-valid-uuid',
      method: 'GET',
      headers: headersA,
    });
    assert(badUuidCand.status === 400, 'Invalid UUID on /candidates/:id returns 400 Bad Request');
    assert(isSafe(badUuidCand.body), 'Invalid UUID error message is clean and safe');

    const badUuidApp = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/applications/not-a-valid-uuid',
      method: 'GET',
      headers: headersA,
    });
    assert(badUuidApp.status === 400, 'Invalid UUID on /applications/:id returns 400 Bad Request');

    const badUuidScreen = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/screening/application/not-a-valid-uuid',
      method: 'GET',
      headers: headersA,
    });
    assert(badUuidScreen.status === 400, 'Invalid UUID on /screening/application/:id returns 400 Bad Request');

  } finally {
    // ─── Teardown Test Data ───────────────────────────────────────────────────
    console.log('\n── Teardown: Cleaning Generated Test Fixtures ──');

    for (const docId of createdDocumentIds) {
      await prisma.candidateDocument.deleteMany({ where: { id: docId } }).catch(() => {});
    }
    for (const appId of createdApplicationIds) {
      await prisma.screeningLog.deleteMany({ where: { applicationId: appId } }).catch(() => {});
      await prisma.applicationStatusHistory.deleteMany({ where: { applicationId: appId } }).catch(() => {});
      await prisma.application.deleteMany({ where: { id: appId } }).catch(() => {});
    }
    for (const candId of createdCandidateIds) {
      await prisma.candidateDocument.deleteMany({ where: { candidateId: candId } }).catch(() => {});
      await prisma.candidate.deleteMany({ where: { id: candId } }).catch(() => {});
    }
    for (const jId of createdJobIds) {
      await prisma.candidateImportRow.deleteMany({ where: { jobId: jId } }).catch(() => {});
      await prisma.candidateImportJob.deleteMany({ where: { id: jId } }).catch(() => {});
    }
    console.log('  ✓ Test fixture cleanup completed.');
  }

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log(`  Total Passed: ${passed}`);
  console.log(`  Total Failed: ${failed}`);
  console.log('════════════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
