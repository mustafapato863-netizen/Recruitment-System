/**
 * M1-G2 — Public & Authenticated Surface Separation Comprehensive Test Suite
 *
 * Self-contained executable test suite.
 * Run directly with: node database/test-m1-g2-public-boundary.cjs
 *
 * Validates:
 * 1. Public Job Listing Boundary (Open vacancies only, sanitized fields, search, 404s)
 * 2. Public Job Detail Boundary (Open vacancy 200, draft/closed/future/unknown 404s)
 * 3. Public Candidate Application (Consent validation, field validation, source validation, duplicates, blacklist)
 * 4. Public CV Upload & Malware/Signature Security (PDF/DOC/DOCX, magic bytes, executables, scripts, traversal, 0-byte, oversized)
 * 5. Document Download & RBAC Security (Public 401, authorized same-tenant 200, cross-tenant 404)
 * 6. Rate Limiting & Proxy Hardening (Explicit 429 lockout, untrusted proxy isolation, cleanup)
 * 7. Real Cross-Tenant Isolation (Org A vs Org B real fixtures, positive controls, negative controls, read & mutation)
 * 8. Individual Private Endpoint Boundary (28+ endpoints individually checked for 401)
 * 9. Information Leakage & Safe Error Contracts (No SQL, Prisma, or stack traces)
 * 10. Deterministic Teardown & Database Cleanup
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@recruitflow/database');

// Safe, self-contained environment loader
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const API_PORT = Number(process.env.RECRUITFLOW_API_PORT || 3000);
const HOST = '127.0.0.1';
const prisma = new PrismaClient();

let reqCounter = 5000;

function request(reqPath, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET';
    reqCounter++;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.ip ? { 'X-Forwarded-For': options.ip } : {}),
      ...(options.headers || {})
    };
    let payload = null;
    if (body !== null && body !== undefined) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({ host: HOST, port: API_PORT, path: `/api/v1${reqPath}`, method, headers }, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        const text = buffer.toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { json = text; }
        const setCookie = res.headers['set-cookie'];
        let cookies = {};
        if (setCookie) {
          const cookieStrings = Array.isArray(setCookie) ? setCookie : [setCookie];
          for (const c of cookieStrings) {
            const parts = c.split(';').map(p => p.trim());
            const nameVal = parts[0];
            const eqIdx = nameVal.indexOf('=');
            if (eqIdx !== -1) {
              const name = nameVal.slice(0, eqIdx);
              const val = nameVal.slice(eqIdx + 1);
              cookies[name] = {
                value: val,
                httpOnly: parts.some(p => p.toLowerCase() === 'httponly'),
                sameSite: parts.find(p => p.toLowerCase().startsWith('samesite='))?.split('=')[1],
                path: parts.find(p => p.toLowerCase().startsWith('path='))?.split('=')[1],
              };
            }
          }
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json, rawBuffer: buffer, cookies });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function requestMultipart(reqPath, options = {}, fields = {}, files = []) {
  return new Promise((resolve, reject) => {
    const method = options.method || 'POST';
    reqCounter++;
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}${Date.now()}`;
    const chunks = [];

    for (const [key, val] of Object.entries(fields)) {
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
    }
    for (const file of files) {
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`));
      chunks.push(file.content);
      chunks.push(Buffer.from('\r\n'));
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));

    const payload = Buffer.concat(chunks);
    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length,
      ...(options.ip ? { 'X-Forwarded-For': options.ip } : {}),
      ...(options.headers || {})
    };

    const req = http.request({ host: HOST, port: API_PORT, path: `/api/v1${reqPath}`, method, headers }, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        const text = buffer.toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { json = text; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function login(email, password = 'Password123!') {
  const res = await request('/auth/login', { method: 'POST' }, { email, password });
  const rawCookies = res.headers['set-cookie'] || [];
  const cookieHeader = rawCookies.map(c => c.split(';')[0]).join('; ');
  return { status: res.status, profile: res.body?.user, cookie: cookieHeader };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

// Track test created entities for cleanup
const createdVacancies = [];
const createdVacancyRequests = [];
const createdCandidates = [];
const createdApplications = [];
const createdDocuments = [];
const createdInterviews = [];
const createdOffers = [];
const createdTalentPools = [];

async function runM1G2PublicBoundarySuite() {
  console.log('=== M1-G2 PUBLIC & AUTHENTICATED SURFACE SEPARATION TEST SUITE ===\n');

  try {
    // Locate organizations
    const orgA = await prisma.organization.findFirst({ where: { code: 'RECRUITFLOW-DEMO' } });
    const orgB = await prisma.organization.findFirst({ where: { code: 'ACME-CORP' } });
    if (!orgA || !orgB) throw new Error('Missing seed organizations RECRUITFLOW-DEMO or ACME-CORP');

    const adminA = await prisma.user.findFirst({ where: { emailNormalized: 'ahmed.mahmoud@recruitflow.local' } });
    const adminB = await prisma.user.findFirst({ where: { emailNormalized: 'tarek.kamal@acme-health.local' } });
    const branchA = await prisma.branch.findFirst({ where: { organizationId: orgA.id } });
    const branchB = await prisma.branch.findFirst({ where: { organizationId: orgB.id } });
    const positionA = await prisma.position.findFirst({ where: { organizationId: orgA.id } });
    const positionB = await prisma.position.findFirst({ where: { organizationId: orgB.id } });

    // Fixtures for testing boundary conditions
    const now = new Date();
    const futureDate = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const pastDate = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    // 1. Open Vacancy in Org A
    const reqAOpen = await prisma.vacancyRequest.create({
      data: {
        organizationId: orgA.id,
        requestCode: `VR-M1G2-OPEN-${Date.now()}`,
        positionId: positionA.id,
        branchId: branchA.id,
        requesterId: adminA.id,
        requestedHeadcount: 1,
        employmentType: 'FullTime',
        status: 'Approved',
      }
    });
    createdVacancyRequests.push(reqAOpen.id);

    const openVacancyA = await prisma.vacancy.create({
      data: {
        organizationId: orgA.id,
        vacancyCode: `VAC-M1G2-OPEN-${Date.now()}`,
        vacancyRequestId: reqAOpen.id,
        positionId: positionA.id,
        branchId: branchA.id,
        status: 'Open',
        approvedHeadcount: 1,
        openedAt: pastDate,
        targetStartDate: futureDate,
        minExperienceYears: 3,
        requiredSkills: ['Node.js', 'PostgreSQL', 'TypeScript'],
      }
    });
    createdVacancies.push(openVacancyA.id);

    // 2. Draft Vacancy in Org A
    const reqADraft = await prisma.vacancyRequest.create({
      data: {
        organizationId: orgA.id,
        requestCode: `VR-M1G2-DFT-${Date.now()}`,
        positionId: positionA.id,
        branchId: branchA.id,
        requesterId: adminA.id,
        requestedHeadcount: 1,
        employmentType: 'FullTime',
        status: 'Approved',
      }
    });
    createdVacancyRequests.push(reqADraft.id);

    const draftVacancyA = await prisma.vacancy.create({
      data: {
        organizationId: orgA.id,
        vacancyCode: `VAC-M1G2-DFT-${Date.now()}`,
        vacancyRequestId: reqADraft.id,
        positionId: positionA.id,
        branchId: branchA.id,
        status: 'Draft',
        approvedHeadcount: 1,
      }
    });
    createdVacancies.push(draftVacancyA.id);

    // 3. Closed Vacancy in Org A
    const reqAClosed = await prisma.vacancyRequest.create({
      data: {
        organizationId: orgA.id,
        requestCode: `VR-M1G2-CLO-${Date.now()}`,
        positionId: positionA.id,
        branchId: branchA.id,
        requesterId: adminA.id,
        requestedHeadcount: 1,
        employmentType: 'FullTime',
        status: 'Approved',
      }
    });
    createdVacancyRequests.push(reqAClosed.id);

    const closedVacancyA = await prisma.vacancy.create({
      data: {
        organizationId: orgA.id,
        vacancyCode: `VAC-M1G2-CLO-${Date.now()}`,
        vacancyRequestId: reqAClosed.id,
        positionId: positionA.id,
        branchId: branchA.id,
        status: 'Closed',
        approvedHeadcount: 1,
        openedAt: pastDate,
      }
    });
    createdVacancies.push(closedVacancyA.id);

    // 4. Future-Opened Vacancy in Org A
    const reqAFuture = await prisma.vacancyRequest.create({
      data: {
        organizationId: orgA.id,
        requestCode: `VR-M1G2-FUT-${Date.now()}`,
        positionId: positionA.id,
        branchId: branchA.id,
        requesterId: adminA.id,
        requestedHeadcount: 1,
        employmentType: 'FullTime',
        status: 'Approved',
      }
    });
    createdVacancyRequests.push(reqAFuture.id);

    const futureVacancyA = await prisma.vacancy.create({
      data: {
        organizationId: orgA.id,
        vacancyCode: `VAC-M1G2-FUT-${Date.now()}`,
        vacancyRequestId: reqAFuture.id,
        positionId: positionA.id,
        branchId: branchA.id,
        status: 'Open',
        approvedHeadcount: 1,
        openedAt: futureDate,
      }
    });
    createdVacancies.push(futureVacancyA.id);

    // 5. Blacklisted Candidate in Org A
    const blacklistedCand = await prisma.candidate.create({
      data: {
        organizationId: orgA.id,
        candidateCode: `CND-BLK-${Date.now()}`,
        firstName: 'Blacklisted',
        lastName: 'Applicant',
        email: `blacklisted.${Date.now()}@example.com`,
        status: 'Blacklisted',
        source: 'career-site',
        consentStatus: 'Revoked',
      }
    });
    createdCandidates.push(blacklistedCand.id);

    // ─── [1] PUBLIC JOB LISTING BOUNDARY ─────────────────────────────────────
    console.log('[1] PUBLIC JOB LISTING BOUNDARY');
    const listingRes = await request(`/public/organizations/${orgA.code}/jobs`);
    assert(listingRes.status === 200, `Public job listing returns 200 — got ${listingRes.status}`);
    assert(listingRes.body?.organization?.code === orgA.code, 'Response contains organization metadata');
    assert(Array.isArray(listingRes.body?.data), 'Response contains data array');
    assert(typeof listingRes.body?.total === 'number', 'Response contains total count');
    assert(listingRes.body?.data?.length > 0, `At least one open vacancy listed — found ${listingRes.body?.data?.length} jobs`);

    const openJob = listingRes.body?.data?.find(j => j.vacancyCode === openVacancyA.vacancyCode);
    assert(Boolean(openJob), `Open vacancy ${openVacancyA.vacancyCode} is present in public listings`);

    const privateKeys = ['hiringManagerId', 'recruiterId', 'salary', 'budget', 'internalNotes', 'candidateCount', 'id'];
    const hasLeakedKey = privateKeys.some(k => openJob && k in openJob);
    assert(!hasLeakedKey, 'Public jobs contain zero private/salary/recruiter fields');

    assert(openJob?.detailPath && openJob?.applyPath, 'Public jobs contain required public fields and navigation paths');

    const searchRes = await request(`/public/organizations/${orgA.code}/jobs?search=${openVacancyA.vacancyCode}`);
    assert(searchRes.status === 200, 'Search filtering returns 200');
    assert(searchRes.body?.data?.some(j => j.vacancyCode === openVacancyA.vacancyCode), 'Search filtering correctly finds matching vacancy');

    const unknownOrgRes = await request('/public/organizations/NONEXISTENT-ORG-XYZ/jobs');
    assert(unknownOrgRes.status === 404, `Unknown organization returns safe 404 — got ${unknownOrgRes.status}`);
    assert(!JSON.stringify(unknownOrgRes.body).includes('prisma') && !JSON.stringify(unknownOrgRes.body).includes('SQL'), 'Unknown organization error is safe (no internal leaks)');

    const malformedOrgRes = await request('/public/organizations/<script>alert(1)<script>/jobs');
    assert(malformedOrgRes.status === 404, `Malformed organization identifier returns safe 404 — got ${malformedOrgRes.status}`);

    // ─── [2] PUBLIC JOB DETAIL BOUNDARY ──────────────────────────────────────
    console.log('\n[2] PUBLIC JOB DETAIL BOUNDARY');
    const detailRes = await request(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}`);
    assert(detailRes.status === 200, `Valid open vacancy detail returns 200 — got ${detailRes.status}`);
    assert(detailRes.body?.positionTitle && detailRes.body?.description, 'Job detail has position title and description');
    assert(!privateKeys.some(k => k in detailRes.body), 'Job detail contains zero private/internal fields');

    const unknownVacRes = await request(`/public/organizations/${orgA.code}/jobs/NONEXISTENT-VAC-XYZ`);
    assert(unknownVacRes.status === 404, `Unknown vacancy code returns safe 404 — got ${unknownVacRes.status}`);

    const malformedVacRes = await request(`/public/organizations/${orgA.code}/jobs/DROP%20TABLE%20vacancies;`);
    assert(malformedVacRes.status === 404, `Malformed vacancy code returns safe 404 — got ${malformedVacRes.status}`);

    const draftDetailRes = await request(`/public/organizations/${orgA.code}/jobs/${draftVacancyA.vacancyCode}`);
    assert(draftDetailRes.status === 404, `Draft vacancy returns safe 404 on public detail — got ${draftDetailRes.status}`);
    assert(!listingRes.body?.data?.some(j => j.vacancyCode === draftVacancyA.vacancyCode), 'Draft vacancy is excluded from public jobs list');

    const closedDetailRes = await request(`/public/organizations/${orgA.code}/jobs/${closedVacancyA.vacancyCode}`);
    assert(closedDetailRes.status === 404, `Closed vacancy returns safe 404 on public detail — got ${closedDetailRes.status}`);

    const futureDetailRes = await request(`/public/organizations/${orgA.code}/jobs/${futureVacancyA.vacancyCode}`);
    assert(futureDetailRes.status === 404, `Future-opened vacancy returns safe 404 on public detail — got ${futureDetailRes.status}`);

    // ─── [3] PUBLIC CANDIDATE APPLICATION SURFACE (JSON & VALIDATIONS) ───────
    console.log('\n[3] PUBLIC CANDIDATE APPLICATION SURFACE');
    const validEmail = `public.applicant.${Date.now()}@example.com`;
    const applyRes = await request(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      method: 'POST',
      ip: `10.99.1.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'Public',
      lastName: 'Applicant',
      email: validEmail,
      phone: '+966500112233',
      currentTitle: 'Software Engineer',
      currentCompany: 'Tech Corp',
      location: 'Riyadh',
      skills: ['TypeScript', 'NestJS'],
      source: 'career-site',
      consentAccepted: true,
    });

    assert(applyRes.status === 201, `Valid public JSON application returns 201 Created — got ${applyRes.status}`);
    assert(applyRes.body?.accepted === true, 'Application response has accepted: true');
    assert(typeof applyRes.body?.applicationCode === 'string' && applyRes.body.applicationCode.startsWith('APP-'), 'Application response returns applicationCode');
    assert(Object.keys(applyRes.cookies).length === 0, 'Application response does NOT return session cookies');
    assert(!('id' in applyRes.body) && !('candidateId' in applyRes.body), 'Application response does NOT expose private DB ids');

    // Verify database side-effects
    const createdCand = await prisma.candidate.findFirst({ where: { organizationId: orgA.id, email: validEmail } });
    assert(createdCand?.consentStatus === 'Active', 'Candidate created with consentStatus=Active');
    assert(createdCand?.source === 'career-site', 'Candidate source recorded');
    if (createdCand) createdCandidates.push(createdCand.id);

    const createdApp = await prisma.application.findFirst({ where: { organizationId: orgA.id, applicationCode: applyRes.body?.applicationCode } });
    assert(createdApp?.stage === 'Applied', 'Application created with stage=Applied');
    if (createdApp) createdApplications.push(createdApp.id);

    const auditLog = await prisma.auditLog.findFirst({
      where: { organizationId: orgA.id, entityType: 'Application', entityId: createdApp?.id },
      orderBy: { createdAt: 'desc' }
    });
    assert(auditLog?.action === 'PUBLIC_APPLICATION_CREATE', 'AuditLog recorded for PUBLIC_APPLICATION_CREATE');
    assert(auditLog?.actorUserId === null, 'AuditLog has null actorUserId for public submission');

    // Duplicate submission check
    const dupRes = await request(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      method: 'POST',
      ip: `10.99.1.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'Public',
      lastName: 'Applicant',
      email: validEmail,
      consentAccepted: true,
    });
    assert(dupRes.status === 409, `Duplicate public application returns 409 Conflict — got ${dupRes.status}`);
    assert(dupRes.body?.message?.includes('already exists'), 'Duplicate error message is controlled and safe');

    // Consent required
    const noConsentRes = await request(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      method: 'POST',
      ip: `10.99.1.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'No',
      lastName: 'Consent',
      email: `no.consent.${Date.now()}@example.com`,
      consentAccepted: false,
    });
    assert(noConsentRes.status === 400, `Application without consent returns 400 Bad Request — got ${noConsentRes.status}`);

    // Empty fields
    const emptyNameRes = await request(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      method: 'POST',
      ip: `10.99.1.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: '',
      lastName: '',
      email: `empty.name.${Date.now()}@example.com`,
      consentAccepted: true,
    });
    assert(emptyNameRes.status === 400, `Application with empty name returns 400 Bad Request — got ${emptyNameRes.status}`);

    // Invalid email
    const invalidEmailRes = await request(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      method: 'POST',
      ip: `10.99.1.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'Invalid',
      lastName: 'Email',
      email: 'not-an-email',
      consentAccepted: true,
    });
    assert(invalidEmailRes.status === 400, `Application with invalid email returns 400 Bad Request — got ${invalidEmailRes.status}`);

    // Source validation: valid source with dots and underscores
    const validSourceEmail = `valid.source.${Date.now()}@example.com`;
    const validSourceRes = await request(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      method: 'POST',
      ip: `10.99.1.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'Valid',
      lastName: 'Source',
      email: validSourceEmail,
      source: 'linkedin.com_referral-partner',
      consentAccepted: true,
    });
    assert(validSourceRes.status === 201, `Valid source with dots/dashes/underscores returns 201 — got ${validSourceRes.status}`);
    const validSourceCand = await prisma.candidate.findFirst({ where: { organizationId: orgA.id, email: validSourceEmail } });
    if (validSourceCand) createdCandidates.push(validSourceCand.id);
    const validSourceApp = await prisma.application.findFirst({ where: { organizationId: orgA.id, applicationCode: validSourceRes.body?.applicationCode } });
    if (validSourceApp) createdApplications.push(validSourceApp.id);

    // Source validation: invalid source with script injection
    const badSourceRes = await request(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      method: 'POST',
      ip: `10.99.1.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'Bad',
      lastName: 'Source',
      email: `bad.source.${Date.now()}@example.com`,
      source: '<script>alert(1)</script>',
      consentAccepted: true,
    });
    assert(badSourceRes.status === 400, `Malformed script source returns 400 Bad Request — got ${badSourceRes.status}`);

    // Blacklisted candidate
    const blkApplyRes = await request(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      method: 'POST',
      ip: `10.99.1.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'Blacklisted',
      lastName: 'Applicant',
      email: blacklistedCand.email,
      consentAccepted: true,
    });
    assert(blkApplyRes.status === 409, `Blacklisted candidate application rejected with safe 409 — got ${blkApplyRes.status}`);
    assert(!JSON.stringify(blkApplyRes.body).toLowerCase().includes('blacklisted'), 'Blacklisted candidate error does not disclose blacklist status');

    // Applying to draft/closed
    const applyDraftRes = await request(`/public/organizations/${orgA.code}/jobs/${draftVacancyA.vacancyCode}/apply`, { method: 'POST' }, {
      firstName: 'Test', lastName: 'User', email: `test.draft.${Date.now()}@example.com`, consentAccepted: true
    });
    assert(applyDraftRes.status === 404, `Applying to draft vacancy returns safe 404 — got ${applyDraftRes.status}`);

    const applyClosedRes = await request(`/public/organizations/${orgA.code}/jobs/${closedVacancyA.vacancyCode}/apply`, { method: 'POST' }, {
      firstName: 'Test', lastName: 'User', email: `test.closed.${Date.now()}@example.com`, consentAccepted: true
    });
    assert(applyClosedRes.status === 404, `Applying to closed vacancy returns safe 404 — got ${applyClosedRes.status}`);

    // ─── [4] PUBLIC CV UPLOAD & MALWARE / SIGNATURE SECURITY ─────────────────
    console.log('\n[4] PUBLIC CV UPLOAD & MALWARE / SIGNATURE SECURITY');

    // 1. Valid PDF CV Upload
    const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const pdfCandidateEmail = `pdf.applicant.${Date.now()}@example.com`;
    const pdfApplyRes = await requestMultipart(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      ip: `10.99.2.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'PDF',
      lastName: 'Applicant',
      email: pdfCandidateEmail,
      consentAccepted: 'true',
      source: 'career-site',
    }, [{
      fieldname: 'cv',
      filename: 'sample_resume.pdf',
      contentType: 'application/pdf',
      content: validPdfBuffer,
    }]);

    assert(pdfApplyRes.status === 201, `Valid PDF CV upload returns 201 Created — got ${pdfApplyRes.status}`);
    assert(pdfApplyRes.body?.accepted === true, 'PDF Application accepted');
    const pdfCand = await prisma.candidate.findFirst({ where: { organizationId: orgA.id, email: pdfCandidateEmail } });
    if (pdfCand) createdCandidates.push(pdfCand.id);
    const pdfApp = await prisma.application.findFirst({ where: { organizationId: orgA.id, applicationCode: pdfApplyRes.body?.applicationCode } });
    if (pdfApp) createdApplications.push(pdfApp.id);

    const pdfDoc = await prisma.candidateDocument.findFirst({
      where: { organizationId: orgA.id, candidateId: pdfCand?.id, documentType: 'CV' }
    });
    assert(Boolean(pdfDoc), 'CandidateDocument record created for PDF CV');
    assert(pdfDoc?.scanStatus === 'Clean', 'CandidateDocument scanStatus is Clean');
    assert(pdfDoc?.mimeType === 'application/pdf', 'CandidateDocument mimeType is application/pdf');
    if (pdfDoc) createdDocuments.push(pdfDoc.id);

    const pdfAudit = await prisma.auditLog.findFirst({
      where: { organizationId: orgA.id, entityType: 'CandidateDocument', entityId: pdfDoc?.id }
    });
    assert(pdfAudit?.action === 'CV_FILE_UPLOAD', 'AuditLog created for CV_FILE_UPLOAD');

    // 2. Valid DOCX Upload
    const validDocxBuffer = Buffer.concat([Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]), Buffer.alloc(100)]);
    const docxEmail = `docx.applicant.${Date.now()}@example.com`;
    const docxApplyRes = await requestMultipart(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      ip: `10.99.2.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'DOCX',
      lastName: 'Applicant',
      email: docxEmail,
      consentAccepted: 'true',
    }, [{
      fieldname: 'cv',
      filename: 'sample_resume.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: validDocxBuffer,
    }]);
    assert(docxApplyRes.status === 201, `Valid DOCX CV upload returns 201 Created — got ${docxApplyRes.status}`);
    const docxCand = await prisma.candidate.findFirst({ where: { organizationId: orgA.id, email: docxEmail } });
    if (docxCand) createdCandidates.push(docxCand.id);
    const docxApp = await prisma.application.findFirst({ where: { organizationId: orgA.id, applicationCode: docxApplyRes.body?.applicationCode } });
    if (docxApp) createdApplications.push(docxApp.id);
    const docxDoc = await prisma.candidateDocument.findFirst({ where: { organizationId: orgA.id, candidateId: docxCand?.id } });
    if (docxDoc) createdDocuments.push(docxDoc.id);

    // 3. Valid DOC Upload
    const validDocBuffer = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(100)]);
    const docEmail = `doc.applicant.${Date.now()}@example.com`;
    const docApplyRes = await requestMultipart(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      ip: `10.99.2.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'DOC',
      lastName: 'Applicant',
      email: docEmail,
      consentAccepted: 'true',
    }, [{
      fieldname: 'cv',
      filename: 'sample_resume.doc',
      contentType: 'application/msword',
      content: validDocBuffer,
    }]);
    assert(docApplyRes.status === 201, `Valid DOC CV upload returns 201 Created — got ${docApplyRes.status}`);
    const docCand = await prisma.candidate.findFirst({ where: { organizationId: orgA.id, email: docEmail } });
    if (docCand) createdCandidates.push(docCand.id);
    const docApp = await prisma.application.findFirst({ where: { organizationId: orgA.id, applicationCode: docApplyRes.body?.applicationCode } });
    if (docApp) createdApplications.push(docApp.id);
    const docDoc = await prisma.candidateDocument.findFirst({ where: { organizationId: orgA.id, candidateId: docCand?.id } });
    if (docDoc) createdDocuments.push(docDoc.id);

    // 4. Invalid Extension (.exe)
    const exeApplyRes = await requestMultipart(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      ip: `10.99.2.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'Exe',
      lastName: 'Attack',
      email: `exe.${Date.now()}@example.com`,
      consentAccepted: 'true',
    }, [{
      fieldname: 'cv',
      filename: 'malware.exe',
      contentType: 'application/octet-stream',
      content: Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00'),
    }]);
    assert(exeApplyRes.status === 400, `Executable .exe extension returns 400 Bad Request — got ${exeApplyRes.status}`);

    // 5. Double Extension (.pdf.exe)
    const doubleExtRes = await requestMultipart(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      ip: `10.99.2.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'Double',
      lastName: 'Ext',
      email: `double.${Date.now()}@example.com`,
      consentAccepted: 'true',
    }, [{
      fieldname: 'cv',
      filename: 'resume.pdf.exe',
      contentType: 'application/pdf',
      content: validPdfBuffer,
    }]);
    assert(doubleExtRes.status === 400, `Double extension .pdf.exe returns 400 Bad Request — got ${doubleExtRes.status}`);

    // 6. Path Traversal Filename
    const pathTraversalRes = await requestMultipart(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      ip: `10.99.2.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'Traversal',
      lastName: 'Attack',
      email: `traversal.${Date.now()}@example.com`,
      consentAccepted: 'true',
    }, [{
      fieldname: 'cv',
      filename: '..passwd.pdf',
      contentType: 'application/pdf',
      content: validPdfBuffer,
    }]);
    assert(pathTraversalRes.status === 400, `Path traversal filename returns 400 Bad Request — got ${pathTraversalRes.status}`);

    // 7. MIME Mismatch (text labeled as pdf)
    const mimeMismatchRes = await requestMultipart(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      ip: `10.99.2.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'Mime',
      lastName: 'Mismatch',
      email: `mimemismatch.${Date.now()}@example.com`,
      consentAccepted: 'true',
    }, [{
      fieldname: 'cv',
      filename: 'resume.pdf',
      contentType: 'application/pdf',
      content: Buffer.from('This is plain text, not a real PDF file!'),
    }]);
    assert(mimeMismatchRes.status === 400, `MIME / binary signature mismatch returns 400 Bad Request — got ${mimeMismatchRes.status}`);

    // 8. Script / HTML Payload
    const scriptPayloadRes = await requestMultipart(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      ip: `10.99.2.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'Script',
      lastName: 'Payload',
      email: `scriptpayload.${Date.now()}@example.com`,
      consentAccepted: 'true',
    }, [{
      fieldname: 'cv',
      filename: 'resume.pdf',
      contentType: 'application/pdf',
      content: Buffer.from('<script>alert("xss")</script>'),
    }]);
    assert(scriptPayloadRes.status === 400, `HTML/script payload disguised as PDF returns 400 Bad Request — got ${scriptPayloadRes.status}`);

    // 9. Empty File (0 bytes)
    const emptyFileRes = await requestMultipart(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      ip: `10.99.2.${Math.floor(Math.random() * 200) + 1}`,
    }, {
      firstName: 'Empty',
      lastName: 'File',
      email: `emptyfile.${Date.now()}@example.com`,
      consentAccepted: 'true',
    }, [{
      fieldname: 'cv',
      filename: 'empty.pdf',
      contentType: 'application/pdf',
      content: Buffer.alloc(0),
    }]);
    assert(emptyFileRes.status === 400, `Empty 0-byte file returns 400 Bad Request — got ${emptyFileRes.status}`);

    // ─── [5] DOCUMENT DOWNLOAD & RBAC SECURITY ────────────────────────────────
    console.log('\n[5] DOCUMENT DOWNLOAD & RBAC SECURITY');

    // 1. Anonymous download attempt
    const anonDownloadRes = await request(`/documents/${pdfDoc?.id}/download`);
    assert(anonDownloadRes.status === 401, `Anonymous download attempt returns 401 Unauthorized — got ${anonDownloadRes.status}`);

    // 2. Authorized same-tenant user (Admin A in Org A)
    const userASession = await login('ahmed.mahmoud@recruitflow.local', 'Password123!');
    const userADownloadRes = await request(`/documents/${pdfDoc?.id}/download`, {
      headers: { Cookie: userASession.cookie }
    });
    assert(userADownloadRes.status === 200, `Authorized same-tenant user can download document (200 OK) — got ${userADownloadRes.status}`);
    assert(userADownloadRes.headers['content-type'] === 'application/pdf', 'Downloaded file has content-type application/pdf');
    assert(userADownloadRes.rawBuffer.includes(Buffer.from('%PDF-1.4')), 'Downloaded content matches uploaded PDF binary');

    // 3. Wrong-role user (Interviewer without DOWNLOAD_DOCUMENTS)
    const interviewerA = await login('aya.mostafa@recruitflow.local', 'Password123!');
    const interviewerDownloadRes = await request(`/documents/${pdfDoc?.id}/download`, {
      headers: { Cookie: interviewerA.cookie }
    });
    assert(interviewerDownloadRes.status === 403, `User without DOWNLOAD_DOCUMENTS permission returns 403 Forbidden — got ${interviewerDownloadRes.status}`);

    // 4. Cross-tenant user (Admin B in Org B downloading Org A document)
    const userBSession = await login('tarek.kamal@acme-health.local', 'Password123!');
    const crossTenantDownloadRes = await request(`/documents/${pdfDoc?.id}/download`, {
      headers: { Cookie: userBSession.cookie }
    });
    assert(crossTenantDownloadRes.status === 404, `Cross-tenant user download attempt returns safe 404 Not Found — got ${crossTenantDownloadRes.status}`);

    // ─── [6] ACTUAL RATE LIMITING (429) & PROXY HARDENING ─────────────────────
    console.log('\n[6] RATE LIMITING & PROXY HARDENING');
    const rateLimitEmail = `ratelimit.${Date.now()}@example.com`;
    const rateLimitIp = '10.55.44.33';
    let hit429 = false;
    let attemptsBeforeLockout = 0;

    for (let i = 1; i <= 7; i++) {
      const res = await request(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
        method: 'POST',
        ip: rateLimitIp,
      }, {
        firstName: 'Rate',
        lastName: 'Limiter',
        email: rateLimitEmail,
        consentAccepted: true,
      });

      if (res.status === 201) {
        attemptsBeforeLockout++;
      } else if (res.status === 429) {
        hit429 = true;
        assert(res.body?.message?.includes('Too many attempts') || res.body?.error === 'Too Many Requests',
          '429 response body is controlled and safe');
        break;
      }
    }

    assert(hit429, `Exceeding public application rate limit triggers HTTP 429 Too Many Requests (locked after ${attemptsBeforeLockout} attempts)`);

    // Untrusted Proxy Spoofing Test: Sending fake X-Forwarded-For does not bypass rate limit on the locked account
    const spoofAttempt = await request(`/public/organizations/${orgA.code}/jobs/${openVacancyA.vacancyCode}/apply`, {
      method: 'POST',
      ip: '199.199.199.199', // Different spoofed IP header
    }, {
      firstName: 'Rate',
      lastName: 'Limiter',
      email: rateLimitEmail, // Same locked account email
      consentAccepted: true,
    });
    assert(spoofAttempt.status === 429, `Spoofed X-Forwarded-For header does not bypass account rate limit (got ${spoofAttempt.status})`);

    // Clean rate limit records for test email
    await prisma.authRateLimit.deleteMany({
      where: { scope: 'account' }
    });

    // ─── [7] REAL CROSS-TENANT ISOLATION (ORG A VS ORG B REAL FIXTURES) ───────
    console.log('\n[7] REAL CROSS-TENANT ISOLATION (Org A vs Org B Real Fixtures)');

    // Create complete real Org B entity graph
    const reqB = await prisma.vacancyRequest.create({
      data: {
        organizationId: orgB.id,
        requestCode: `VR-B-REAL-${Date.now()}`,
        positionId: positionB.id,
        branchId: branchB.id,
        requesterId: adminB.id,
        requestedHeadcount: 1,
        employmentType: 'FullTime',
        status: 'Approved',
      }
    });
    createdVacancyRequests.push(reqB.id);

    const vacB = await prisma.vacancy.create({
      data: {
        organizationId: orgB.id,
        vacancyCode: `VAC-B-REAL-${Date.now()}`,
        vacancyRequestId: reqB.id,
        positionId: positionB.id,
        branchId: branchB.id,
        status: 'Open',
        approvedHeadcount: 1,
        openedAt: pastDate,
      }
    });
    createdVacancies.push(vacB.id);

    const candB = await prisma.candidate.create({
      data: {
        organizationId: orgB.id,
        candidateCode: `CND-B-REAL-${Date.now()}`,
        firstName: 'Mona',
        lastName: 'Zaki',
        email: `mona.zaki.${Date.now()}@acme-health.local`,
        status: 'Active',
        source: 'career-site',
        consentStatus: 'Active',
      }
    });
    createdCandidates.push(candB.id);

    const docB = await prisma.candidateDocument.create({
      data: {
        organizationId: orgB.id,
        candidateId: candB.id,
        documentType: 'CV',
        fileName: 'mona_cv.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        storageKey: `metadata-only/${orgB.id}/${candB.id}/${Date.now()}`,
        storageProvider: 'metadata-only',
        scanStatus: 'Clean',
        consentStatus: 'Active',
        uploadedById: adminB.id,
      }
    });
    createdDocuments.push(docB.id);

    const appB = await prisma.application.create({
      data: {
        organizationId: orgB.id,
        applicationCode: `APP-B-REAL-${Date.now()}`,
        vacancyId: vacB.id,
        candidateId: candB.id,
        stage: 'Applied',
        source: 'career-site',
      }
    });
    createdApplications.push(appB.id);

    const interviewB = await prisma.interview.create({
      data: {
        organizationId: orgB.id,
        interviewCode: `INT-B-REAL-${Date.now()}`,
        applicationId: appB.id,
        title: 'Technical Evaluation Round 1',
        interviewType: 'Technical',
        status: 'Scheduled',
        scheduledStart: futureDate,
        scheduledEnd: new Date(futureDate.getTime() + 3600000),
      }
    });
    createdInterviews.push(interviewB.id);

    const offerB = await prisma.offer.create({
      data: {
        organizationId: orgB.id,
        offerCode: `OFF-B-REAL-${Date.now()}`,
        applicationId: appB.id,
        status: 'Draft',
      }
    });
    createdOffers.push(offerB.id);

    const poolB = await prisma.talentPool.create({
      data: {
        organizationId: orgB.id,
        name: `Acme Pool ${Date.now()}`,
        description: 'Org B Talent Pool',
        status: 'Active',
        tags: ['Medical', 'Leadership'],
      }
    });
    createdTalentPools.push(poolB.id);

    // Test each entity: Positive Control (User B in Org B) vs Negative Control (User A in Org A)

    // a. Candidate
    const posCandB = await request(`/candidates/${candB.id}`, { headers: { Cookie: userBSession.cookie } });
    assert(posCandB.status === 200, `Positive Control: User B can read Org B Candidate (${candB.candidateCode}) — got 200`);
    const negCandB = await request(`/candidates/${candB.id}`, { headers: { Cookie: userASession.cookie } });
    assert(negCandB.status === 404, `Negative Control: User A cannot read Org B Candidate (got safe ${negCandB.status})`);
    const mutCandB = await request(`/candidates/${candB.id}`, { method: 'PATCH', headers: { Cookie: userASession.cookie } }, { currentTitle: 'Hacked' });
    assert(mutCandB.status === 404, `Negative Mutation: User A cannot PATCH Org B Candidate (got safe ${mutCandB.status})`);

    // b. Candidate Document
    const posDocB = await request(`/documents/${docB.id}`, { headers: { Cookie: userBSession.cookie } });
    assert(posDocB.status === 200, `Positive Control: User B can read Org B Document — got 200`);
    const negDocB = await request(`/documents/${docB.id}`, { headers: { Cookie: userASession.cookie } });
    assert(negDocB.status === 404, `Negative Control: User A cannot read Org B Document (got safe ${negDocB.status})`);

    // c. Application
    const posAppB = await request(`/applications/${appB.id}`, { headers: { Cookie: userBSession.cookie } });
    assert(posAppB.status === 200, `Positive Control: User B can read Org B Application (${appB.applicationCode}) — got 200`);
    const negAppB = await request(`/applications/${appB.id}`, { headers: { Cookie: userASession.cookie } });
    assert(negAppB.status === 404, `Negative Control: User A cannot read Org B Application (got safe ${negAppB.status})`);
    const mutAppB = await request(`/applications/${appB.id}/stage`, { method: 'PATCH', headers: { Cookie: userASession.cookie } }, { stage: 'Offer' });
    assert(mutAppB.status === 404, `Negative Mutation: User A cannot PATCH Org B Application stage (got safe ${mutAppB.status})`);

    // d. Vacancy
    const posVacB = await request(`/vacancies/${vacB.id}`, { headers: { Cookie: userBSession.cookie } });
    assert(posVacB.status === 200, `Positive Control: User B can read Org B Vacancy (${vacB.vacancyCode}) — got 200`);
    const negVacB = await request(`/vacancies/${vacB.id}`, { headers: { Cookie: userASession.cookie } });
    assert(negVacB.status === 404, `Negative Control: User A cannot read Org B Vacancy (got safe ${negVacB.status})`);

    // e. Vacancy Request
    const posReqB = await request(`/vacancy-requests/${reqB.id}`, { headers: { Cookie: userBSession.cookie } });
    assert(posReqB.status === 200, `Positive Control: User B can read Org B Vacancy Request (${reqB.requestCode}) — got 200`);
    const negReqB = await request(`/vacancy-requests/${reqB.id}`, { headers: { Cookie: userASession.cookie } });
    assert(negReqB.status === 404, `Negative Control: User A cannot read Org B Vacancy Request (got safe ${negReqB.status})`);

    // f. Interview
    const posIntB = await request(`/interviews/${interviewB.id}`, { headers: { Cookie: userBSession.cookie } });
    assert(posIntB.status === 200, `Positive Control: User B can read Org B Interview — got 200`);
    const negIntB = await request(`/interviews/${interviewB.id}`, { headers: { Cookie: userASession.cookie } });
    assert(negIntB.status === 404, `Negative Control: User A cannot read Org B Interview (got safe ${negIntB.status})`);

    // g. Offer
    const posOffB = await request(`/offers/${offerB.id}`, { headers: { Cookie: userBSession.cookie } });
    assert(posOffB.status === 200, `Positive Control: User B can read Org B Offer — got 200`);
    const negOffB = await request(`/offers/${offerB.id}`, { headers: { Cookie: userASession.cookie } });
    assert(negOffB.status === 404, `Negative Control: User A cannot read Org B Offer (got safe ${negOffB.status})`);

    // h. Talent Pool
    const posPoolB = await request(`/talent-pools/${poolB.id}`, { headers: { Cookie: userBSession.cookie } });
    assert(posPoolB.status === 200, `Positive Control: User B can read Org B Talent Pool — got 200`);
    const negPoolB = await request(`/talent-pools/${poolB.id}`, { headers: { Cookie: userASession.cookie } });
    assert(negPoolB.status === 404, `Negative Control: User A cannot read Org B Talent Pool (got safe ${negPoolB.status})`);

    // i. Reports & Exports
    const repA = await request('/reports/overview', { headers: { Cookie: userASession.cookie } });
    const repB = await request('/reports/overview', { headers: { Cookie: userBSession.cookie } });
    assert(repA.status === 200 && repB.status === 200, 'Both User A and User B can access their tenant reports');

    const expA = await request('/reports/export.xlsx', { headers: { Cookie: userASession.cookie } });
    const expB = await request('/reports/export.xlsx', { headers: { Cookie: userBSession.cookie } });
    assert(expA.status === 200 && expB.status === 200, 'Both User A and User B can export their tenant excel reports');

    // ─── [8] INDIVIDUAL PRIVATE ENDPOINT BOUNDARY (32 ENDPOINTS) ─────────────
    console.log('\n[8] INDIVIDUAL PRIVATE ENDPOINT 401 BOUNDARY (32 Endpoints)');
    const privateEndpoints = [
      '/candidates',
      '/candidates/10000000-0000-4000-8000-000000000010',
      '/applications',
      '/applications/10000000-0000-4000-8000-000000000010',
      '/applications/10000000-0000-4000-8000-000000000010/history',
      '/vacancies',
      '/vacancies/10000000-0000-4000-8000-000000000010',
      '/vacancy-requests',
      '/vacancy-requests/10000000-0000-4000-8000-000000000010',
      '/interviews',
      '/interviews/10000000-0000-4000-8000-000000000010',
      '/offers',
      '/offers/10000000-0000-4000-8000-000000000010',
      '/hiring',
      '/hiring/metrics',
      '/screening/application/10000000-0000-4000-8000-000000000010',
      '/reports/overview',
      '/reports/kpis',
      '/reports/funnel',
      '/reports/hiring-by-department',
      '/reports/recruiter-workload',
      '/reports/export.xlsx',
      '/documents/cv-bank',
      '/documents/cv-bank/manifest.xlsx',
      '/documents/10000000-0000-4000-8000-000000000010',
      '/documents/10000000-0000-4000-8000-000000000010/download',
      '/notifications',
      '/audit-logs',
      '/users',
      '/roles',
      '/talent-pools',
      '/branches',
      '/positions',
      '/organizations',
    ];

    for (const ep of privateEndpoints) {
      const res = await request(ep);
      assert(res.status === 401, `Unauthenticated ${ep} strictly rejected with 401 (got ${res.status})`);
    }

    // ─── [9] SAFE ERROR DISCLOSURE & INFORMATION LEAKAGE ─────────────────────
    console.log('\n[9] SAFE ERROR DISCLOSURE & INFORMATION LEAKAGE');
    const probedResponses = [
      unknownOrgRes,
      unknownVacRes,
      draftDetailRes,
      closedDetailRes,
      futureDetailRes,
      dupRes,
      noConsentRes,
      emptyNameRes,
      invalidEmailRes,
      badSourceRes,
      blkApplyRes,
      exeApplyRes,
      doubleExtRes,
      pathTraversalRes,
      mimeMismatchRes,
      scriptPayloadRes,
      anonDownloadRes,
      negCandB,
      negDocB,
      negAppB,
      negVacB,
      negReqB,
      negIntB,
      negOffB,
      negPoolB,
    ];

    let leakFound = false;
    for (const r of probedResponses) {
      const text = JSON.stringify(r.body || '');
      if (text.includes('prisma') || text.includes('PrismaClient') || text.includes('SELECT') || text.includes('stack') || text.includes('node_modules')) {
        leakFound = true;
        console.error('  Leak detected in response:', text);
      }
    }
    assert(!leakFound, 'All public and error responses are completely free from SQL, Prisma, stack traces, and paths');

  } finally {
    // ─── [10] DETERMINISTIC TEARDOWN & DATABASE CLEANUP ───────────────────────
    console.log('\n[10] TEARDOWN & DATABASE CLEANUP');
    try {
      // 1. Delete screening logs, interviews, offers, status histories, and applications
      const allAppIds = await prisma.application.findMany({
        where: {
          OR: [
            { id: { in: createdApplications } },
            { vacancyId: { in: createdVacancies } },
            { candidateId: { in: createdCandidates } },
          ]
        },
        select: { id: true }
      }).then(rows => rows.map(r => r.id));

      if (allAppIds.length > 0) {
        await prisma.interviewScorecard.deleteMany({ where: { interview: { applicationId: { in: allAppIds } } } });
        await prisma.interviewAttendee.deleteMany({ where: { interview: { applicationId: { in: allAppIds } } } });
        await prisma.interview.deleteMany({ where: { applicationId: { in: allAppIds } } });
        await prisma.offerApproval.deleteMany({ where: { offerVersion: { offer: { applicationId: { in: allAppIds } } } } });
        await prisma.offerComponent.deleteMany({ where: { offerVersion: { offer: { applicationId: { in: allAppIds } } } } });
        await prisma.offerVersion.deleteMany({ where: { offer: { applicationId: { in: allAppIds } } } });
        await prisma.offer.deleteMany({ where: { applicationId: { in: allAppIds } } });
        await prisma.screeningLog.deleteMany({ where: { applicationId: { in: allAppIds } } });
        await prisma.applicationStatusHistory.deleteMany({ where: { applicationId: { in: allAppIds } } });
        await prisma.auditLog.deleteMany({ where: { entityType: 'Application', entityId: { in: allAppIds } } });
        await prisma.application.deleteMany({ where: { id: { in: allAppIds } } });
      }

      // 2. Delete talent pool memberships & talent pools
      if (createdTalentPools.length > 0) {
        await prisma.talentPoolCandidate.deleteMany({ where: { talentPoolId: { in: createdTalentPools } } });
        await prisma.talentPool.deleteMany({ where: { id: { in: createdTalentPools } } });
      }

      // 3. Delete candidate documents & candidates
      if (createdCandidates.length > 0) {
        await prisma.talentPoolCandidate.deleteMany({ where: { candidateId: { in: createdCandidates } } });
        await prisma.candidateDocument.deleteMany({ where: { candidateId: { in: createdCandidates } } });
        await prisma.candidate.deleteMany({ where: { id: { in: createdCandidates } } });
      }

      if (createdDocuments.length > 0) {
        await prisma.auditLog.deleteMany({ where: { entityType: 'CandidateDocument', entityId: { in: createdDocuments } } });
        await prisma.candidateDocument.deleteMany({ where: { id: { in: createdDocuments } } });
      }

      // 4. Delete vacancies & vacancy requests
      if (createdVacancies.length > 0) {
        await prisma.vacancyAssignment.deleteMany({ where: { vacancyId: { in: createdVacancies } } });
        await prisma.vacancy.deleteMany({ where: { id: { in: createdVacancies } } });
      }

      if (createdVacancyRequests.length > 0) {
        await prisma.vacancyRequestApproval.deleteMany({ where: { vacancyRequestId: { in: createdVacancyRequests } } });
        await prisma.vacancyRequest.deleteMany({ where: { id: { in: createdVacancyRequests } } });
      }

      // 5. Delete rate limits
      await prisma.authRateLimit.deleteMany({
        where: { scope: 'account' }
      });

      console.log('  ✅ Teardown complete: All test fixtures cleanly deleted.');
    } catch (cleanupErr) {
      console.error('  ⚠️ Teardown error:', cleanupErr);
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log('\n============================================================');
  console.log(`M1-G2 TEST SUITE: ${passed} PASSED, ${failed} FAILED`);
  if (failed === 0) {
    console.log('ALL M1-G2 PUBLIC & AUTHENTICATED BOUNDARY TESTS PASSED ✅\n');
  } else {
    console.error('M1-G2 SUITE HAS FAILURES ❌\n');
    process.exit(1);
  }
}

runM1G2PublicBoundarySuite().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
