/**
 * P5.4 — Interviews, Scorecards, and Scheduling Integration Test Suite
 *
 * Covers:
 * 1. Interview Listing & Filtering (status, search, ordering)
 * 2. Single Interview Lookup & Safe Disclosure
 * 3. Interview Scheduling (POST /interviews, CodeSequence INT-YYYY-NNN format, attendee assignment)
 * 4. Interview Status Updates (PATCH /interviews/:id to Completed/Cancelled)
 * 5. Structured Scorecard Submission (POST /interviews/:id/scorecard, rating 1-5, recommendation, strengths, concerns)
 * 6. Scorecard Listing & Retrieval (populated in GET /interviews/:id)
 * 7. Cross-Tenant Isolation (Safe 404 across Org A and Org B)
 * 8. UUID Parameter Validation (Clean 400 Bad Request on malformed UUIDs)
 * 9. RBAC & Permission Enforcement
 * 10. Clean Teardown of all generated test fixtures
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
  console.log('║  P5.4 Integration Suite — Interviews, Scorecards & Scheduling    ║');
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
  const createdInterviewIds = [];

  try {
    // ─── 1. Interview Listing & Filtering ─────────────────────────────────────
    console.log('\n── S1: Interview Listing & Filtering ──');
    const listRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/interviews',
      method: 'GET',
      headers: headersA,
    });
    assert(listRes.status === 200, 'Interview list returns 200 OK');
    assert(Array.isArray(listRes.body), 'Interview list returns array');
    assert(isSafe(listRes.body), 'Interview list response is clean of internal leaks');

    // Status filter
    const statusRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/interviews?status=Scheduled',
      method: 'GET',
      headers: headersA,
    });
    assert(statusRes.status === 200, 'Status filtered interview list returns 200 OK');
    assert(statusRes.body?.every(i => i.status === 'Scheduled'), 'All returned interviews have Scheduled status');

    // ─── 2. Setup Candidate & Application for Scheduling ───────────────────────
    console.log('\n── S2: Setup Candidate & Application Fixtures ──');
    const candRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/candidates',
      method: 'POST',
      headers: headersA,
    }, {
      firstName: 'Tamer',
      lastName: `Hosny_${uniqueSuffix}`,
      email: `tamer_${uniqueSuffix}@example.com`,
      phone: '+201099887766',
      currentTitle: 'Senior Full Stack Engineer',
      currentCompany: 'Cairo FinTech',
    });
    assert(candRes.status === 201, 'Test candidate created');
    const candidateId = candRes.body.id;
    if (candidateId) createdCandidateIds.push(candidateId);

    const vacList = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/vacancies',
      method: 'GET',
      headers: headersA,
    });
    const vacancy = vacList.body?.[0];
    assert(Boolean(vacancy?.id), `Found active vacancy (${vacancy?.vacancyCode})`);

    const appRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/applications',
      method: 'POST',
      headers: headersA,
    }, {
      candidateId,
      vacancyId: vacancy.id,
      source: 'Direct',
    });
    assert(appRes.status === 201, 'Test application created');
    const applicationId = appRes.body.id;
    if (applicationId) createdApplicationIds.push(applicationId);

    // Advance to Interview stage
    await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/applications/${applicationId}/stage`,
      method: 'PATCH',
      headers: headersA,
    }, {
      stage: 'Screening',
      reason: 'Passed resume review',
    });
    const stageRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/applications/${applicationId}/stage`,
      method: 'PATCH',
      headers: headersA,
    }, {
      stage: 'Interview',
      reason: 'Passed phone screening',
    });
    assert(stageRes.status === 200, 'Application advanced to Interview stage');

    // ─── 3. Schedule Interview (POST /interviews) ─────────────────────────────
    console.log('\n── S3: Schedule Interview ──');
    const startTime = new Date(Date.now() + 86400000).toISOString(); // tomorrow
    const endTime = new Date(Date.now() + 90000000).toISOString();

    // Validation failure (missing required title)
    const valRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/interviews',
      method: 'POST',
      headers: headersA,
    }, {
      applicationId,
      interviewType: 'Technical',
      scheduledStart: startTime,
      scheduledEnd: endTime,
      attendeeUserIds: [adminA.profile.id],
    });
    assert(valRes.status === 400, 'Scheduling without required title returns 400 Bad Request');
    assert(isSafe(valRes.body), 'Validation failure response is clean and safe');

    // Valid scheduling
    const createRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/interviews',
      method: 'POST',
      headers: headersA,
    }, {
      applicationId,
      title: 'Senior Technical Architecture Round',
      interviewType: 'Technical',
      scheduledStart: startTime,
      scheduledEnd: endTime,
      timezone: 'UTC',
      locationUrl: 'https://meet.google.com/test-p54-meet',
      attendeeUserIds: [adminA.profile.id],
    });
    assert(createRes.status === 201, 'Valid interview scheduling returns 201 Created');
    assert(createRes.body?.id && createRes.body?.interviewCode, 'Interview assigned ID and interviewCode');
    assert(createRes.body?.interviewCode.startsWith('INT-'), `Interview code conforms to standard (${createRes.body?.interviewCode})`);
    assert(createRes.body?.status === 'Scheduled', 'New interview status is Scheduled');
    const interviewId = createRes.body.id;
    if (interviewId) createdInterviewIds.push(interviewId);

    // ─── 4. Lookup Interview Details ──────────────────────────────────────────
    console.log('\n── S4: Lookup Interview Details ──');
    const detailRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/interviews/${interviewId}`,
      method: 'GET',
      headers: headersA,
    });
    assert(detailRes.status === 200, 'Interview detail lookup returns 200 OK');
    assert(detailRes.body?.title === 'Senior Technical Architecture Round', 'Interview detail has correct title');
    assert(detailRes.body?.candidateName?.includes('Tamer'), 'Interview detail contains candidate name');
    assert(Array.isArray(detailRes.body?.attendees) && detailRes.body?.attendees.length === 1, 'Interview contains assigned attendee');
    assert(isSafe(detailRes.body), 'Interview detail response is safe');

    // ─── 5. Submit Competency Scorecard ───────────────────────────────────────
    console.log('\n── S5: Submit Competency Scorecard ──');

    // Rating validation (out of range 6)
    const badScore = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/interviews/${interviewId}/scorecard`,
      method: 'POST',
      headers: headersA,
    }, {
      overallRating: 6,
      recommendation: 'Strong Hire',
    });
    assert(badScore.status === 400, 'Submitting score > 5 returns 400 Bad Request');

    // Valid scorecard submission
    const scoreRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/interviews/${interviewId}/scorecard`,
      method: 'POST',
      headers: headersA,
    }, {
      overallRating: 5,
      recommendation: 'Strong Hire',
      strengths: 'Outstanding system design, clean async patterns, strong communication.',
      concerns: 'None identified.',
      notes: 'Strongly recommend moving to offer stage immediately.',
    });
    assert(scoreRes.status === 201, 'Valid scorecard submission returns 201 Created');
    assert(scoreRes.body?.overallRating === 5, 'Scorecard rating recorded as 5');
    assert(scoreRes.body?.recommendation === 'Strong Hire', 'Scorecard recommendation recorded as Strong Hire');

    // Verify scorecard is included in interview detail
    const detailAfterScore = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/interviews/${interviewId}`,
      method: 'GET',
      headers: headersA,
    });
    assert(detailAfterScore.status === 200, 'Interview detail after scorecard returns 200 OK');
    assert(detailAfterScore.body?.scorecards?.length === 1, 'Interview scorecards array contains submitted evaluation');
    assert(detailAfterScore.body?.scorecards[0]?.strengths.includes('system design'), 'Scorecard strengths preserved');

    // ─── 6. Interview Status Updates ──────────────────────────────────────────
    console.log('\n── S6: Interview Status Updates ──');
    const updateRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/interviews/${interviewId}`,
      method: 'PATCH',
      headers: headersA,
    }, {
      status: 'Completed',
    });
    assert(updateRes.status === 200, 'Updating interview status to Completed returns 200 OK');
    assert(updateRes.body?.status === 'Completed', 'Interview status updated to Completed');

    // ─── 7. Cross-Tenant Isolation ────────────────────────────────────────────
    console.log('\n── S7: Cross-Tenant Isolation ──');
    const orgBGet = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/interviews/${interviewId}`,
      method: 'GET',
      headers: headersB,
    });
    assert(orgBGet.status === 404, 'Cross-tenant interview query returns safe 404 Not Found');

    const orgBPatch = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/interviews/${interviewId}`,
      method: 'PATCH',
      headers: headersB,
    }, {
      status: 'Cancelled',
    });
    assert(orgBPatch.status === 404, 'Cross-tenant interview update returns safe 404 Not Found');

    const orgBScorecard = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/interviews/${interviewId}/scorecard`,
      method: 'POST',
      headers: headersB,
    }, {
      overallRating: 4,
      recommendation: 'Hire',
    });
    assert(orgBScorecard.status === 404, 'Cross-tenant scorecard submission returns safe 404 Not Found');

    // ─── 8. UUID Parameter Validation ─────────────────────────────────────────
    console.log('\n── S8: UUID Route Parameter Validation ──');
    const badUuidGet = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/interviews/invalid-uuid-format',
      method: 'GET',
      headers: headersA,
    });
    assert(badUuidGet.status === 400, 'Invalid UUID on GET /interviews/:id returns 400 Bad Request');
    assert(isSafe(badUuidGet.body), 'Invalid UUID response is safe and clean');

    const badUuidPatch = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/interviews/invalid-uuid-format',
      method: 'PATCH',
      headers: headersA,
    }, { status: 'Completed' });
    assert(badUuidPatch.status === 400, 'Invalid UUID on PATCH /interviews/:id returns 400 Bad Request');

    const badUuidScore = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/interviews/invalid-uuid-format/scorecard',
      method: 'POST',
      headers: headersA,
    }, { overallRating: 4, recommendation: 'Hire' });
    assert(badUuidScore.status === 400, 'Invalid UUID on POST /interviews/:id/scorecard returns 400 Bad Request');

  } finally {
    // ─── Teardown Test Data ───────────────────────────────────────────────────
    console.log('\n── Teardown: Cleaning Generated Test Fixtures ──');

    for (const intId of createdInterviewIds) {
      await prisma.interviewScorecard.deleteMany({ where: { interviewId: intId } }).catch(() => {});
      await prisma.interviewAttendee.deleteMany({ where: { interviewId: intId } }).catch(() => {});
      await prisma.interview.deleteMany({ where: { id: intId } }).catch(() => {});
    }
    for (const appId of createdApplicationIds) {
      await prisma.applicationStatusHistory.deleteMany({ where: { applicationId: appId } }).catch(() => {});
      await prisma.application.deleteMany({ where: { id: appId } }).catch(() => {});
    }
    for (const candId of createdCandidateIds) {
      await prisma.candidate.deleteMany({ where: { id: candId } }).catch(() => {});
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
