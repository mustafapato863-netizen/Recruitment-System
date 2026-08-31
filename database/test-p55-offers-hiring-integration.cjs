/**
 * P5.5 — Offers, Hiring Cases, Compliance, Final Approval, and Joining Integration Test Suite
 *
 * Scenarios Tested:
 * 1. Offers List & Filtering (GET /offers)
 * 2. Offer Creation Validation & Atomic Code Sequence (POST /offers -> OFR-YYYY-NNN)
 * 3. Offer Revisions (POST /offers/:id/revisions)
 * 4. Offer Approval Routing & Inbox (GET /offers/approvals/inbox)
 * 5. Offer Approval Decisions (POST /offers/approvals/:id/decide -> Approve / Reject)
 * 6. Enforcing Approved State Before Sending (Blocked state validation)
 * 7. Offer Distribution to Candidate (PATCH /offers/:id/status -> Sent)
 * 8. Candidate Decision (PATCH /offers/:id/status -> Accepted)
 * 9. Hiring Case Creation & Default Compliance Checklist (POST /hiring)
 * 10. Compliance Checklist Verification (PATCH /hiring/:id/compliance/:reqId)
 * 11. Final Approval Gate Enforcement (Blocked if compliance items pending)
 * 12. Final Approval Submission (POST /hiring/:id/submit)
 * 13. Final Approval Inbox & Decision (GET /hiring/final-approvals, POST /hiring/:id/final-approval)
 * 14. Joining Confirmation & Atomic Vacancy Headcount Updates (POST /hiring/:id/joining)
 * 15. Cross-Tenant Isolation (Safe 404 for Org B on Org A offers & hires)
 * 16. UUID Parameter Validation (Clean 400 Bad Request on invalid UUIDs)
 * 17. Clean Teardown of generated fixtures
 */

const http = require('http');
const { randomUUID } = require('crypto');
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
    'column "', 'table "', 'syntax error at', 'stack', 'passwordHash',
  ];
  return !dangerous.some(term => str.includes(term));
}

// ─── Test Suite Runner ─────────────────────────────────────────────────────────
async function runTests() {
  console.log('='.repeat(70));
  console.log('P5.5 — Offers, Hiring Cases, Compliance, Approval & Joining Suite');
  console.log('='.repeat(70));

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details) {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}`);
      if (details) console.error(`         Details: ${JSON.stringify(details)}`);
      failed++;
    }
  }

  // 1. Authenticate users
  console.log('\n--- Step 1: Authentication ---');
  const orgAAdmin = await login('ahmed.mahmoud@recruitflow.local', 'Password123!');
  assert('Org A Admin logged in', orgAAdmin.status === 200 && !!orgAAdmin.cookie);

  const orgARecruiter = await login('sarah.ahmed@recruitflow.local', 'Password123!');
  assert('Org A Recruiter logged in', orgARecruiter.status === 200 && !!orgARecruiter.cookie);

  const orgBAdmin = await login('tarek.kamal@acme-health.local', 'Password123!');
  assert('Org B Admin logged in', orgBAdmin.status === 200 && !!orgBAdmin.cookie);

  // Fixture tracking
  const createdOfferIds = [];
  const createdHiringCaseIds = [];
  const createdCandidateIds = [];
  const createdVacancyIds = [];
  const createdVacancyRequestIds = [];
  const createdApplicationIds = [];

  let testCandidate;
  let testPosition;
  let testBranch;
  let testVacancy;
  let testApplication;
  let createdOffer;
  let createdHiringCase;
  let fullCapacityHiringCase;
  let fullCapacityOffer;
  let fullCapacityCandidate;
  let fullCapacityApplication;

  try {
    // 2. Setup Test Data Fixtures
    console.log('\n--- Step 2: Test Fixture Provisioning ---');
    const orgAAdminRecord = await prisma.user.findFirst({
      where: { emailNormalized: 'ahmed.mahmoud@recruitflow.local' },
      select: { id: true, organizationId: true },
    });
    if (!orgAAdminRecord) throw new Error('Org A admin fixture is missing');

    const baseVacancy = await prisma.vacancy.findFirst({
      where: { organizationId: orgAAdminRecord.organizationId, status: 'Open' },
      select: { branchId: true, positionId: true, legalEntityId: true },
    });
    if (!baseVacancy) throw new Error('No open vacancy context exists for the joining fixture');

    const fixtureToken = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const fixtureRequest = await prisma.vacancyRequest.create({
      data: {
        organizationId: orgAAdminRecord.organizationId,
        legalEntityId: baseVacancy.legalEntityId,
        branchId: baseVacancy.branchId,
        positionId: baseVacancy.positionId,
        requesterId: orgAAdminRecord.id,
        requestCode: `VR-TEST-${fixtureToken}`,
        status: 'Approved',
        requestedHeadcount: 1,
        employmentType: 'Full-time',
        reason: 'Joining acceptance test fixture',
        budgetStatus: 'Budgeted',
        criticality: 'Normal',
        targetStartDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        justification: 'Isolated capacity-available fixture for P8 joining acceptance.',
        submittedAt: new Date(),
        approvalRevision: 1,
      },
    });
    createdVacancyRequestIds.push(fixtureRequest.id);

    testVacancy = await prisma.vacancy.create({
      data: {
        organizationId: orgAAdminRecord.organizationId,
        legalEntityId: baseVacancy.legalEntityId,
        branchId: baseVacancy.branchId,
        positionId: baseVacancy.positionId,
        vacancyRequestId: fixtureRequest.id,
        vacancyCode: `VAC-TEST-${fixtureToken}`,
        status: 'Open',
        approvedHeadcount: 1,
        joinedHeadcount: 0,
        openedAt: new Date(),
        targetStartDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    createdVacancyIds.push(testVacancy.id);
    assert('Capacity-available vacancy fixture created', testVacancy.approvedHeadcount > testVacancy.joinedHeadcount);

    const candRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/candidates',
      method: 'POST',
      headers: { Cookie: orgAAdmin.cookie },
    }, {
      firstName: 'Tariq',
      lastName: 'Mansour',
      email: `tariq.mansour.${Date.now()}@example.com`,
      phone: '+971501928374',
      currentTitle: 'Principal Architect',
    });
    assert('Test Candidate created in Org A', candRes.status === 201 && !!candRes.body?.id);
    testCandidate = candRes.body;
    createdCandidateIds.push(testCandidate.id);
    const initialJoinedCount = testVacancy.joinedHeadcount || 0;

    const appRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/applications',
      method: 'POST',
      headers: { Cookie: orgAAdmin.cookie },
    }, {
      candidateId: testCandidate.id,
      vacancyId: testVacancy.id,
      source: 'Direct',
    });
    assert('Test Application created in Org A', appRes.status === 201 && !!appRes.body?.id);
    testApplication = appRes.body;
    createdApplicationIds.push(testApplication.id);

    // 3. Offers Listing
    console.log('\n--- Step 3: Offers Listing & Filtering ---');
    const offersListRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/offers', method: 'GET',
      headers: { Cookie: orgAAdmin.cookie },
    });
    assert('GET /offers returns 200', offersListRes.status === 200);
    assert('GET /offers returns array', Array.isArray(offersListRes.body));
    assert('GET /offers response payload is safe', isSafe(offersListRes.body));

    // 4. Offer Creation Validation Failures
    console.log('\n--- Step 4: Offer Creation Validation Failures ---');
    const invalidAppOfferRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/offers', method: 'POST',
      headers: { Cookie: orgAAdmin.cookie },
    }, {
      applicationId: '00000000-0000-0000-0000-000000000000',
      components: [{ type: 'Salary', name: 'Basic', amount: 10000, currency: 'AED', frequency: 'Monthly', isTaxable: true }],
    });
    assert('POST /offers with non-existent application returns 404', invalidAppOfferRes.status === 404);

    const invalidCompOfferRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/offers', method: 'POST',
      headers: { Cookie: orgAAdmin.cookie },
    }, {
      applicationId: testApplication.id,
      components: 'invalid-components',
    });
    assert('POST /offers with invalid components returns 400', invalidCompOfferRes.status === 400);

    // 5. Offer Creation & Atomic Code Sequence
    console.log('\n--- Step 5: Successful Offer Creation ---');
    const createOfferRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/offers', method: 'POST',
      headers: { Cookie: orgAAdmin.cookie },
    }, {
      applicationId: testApplication.id,
      contractType: 'Permanent',
      probationPeriod: '6 Months',
      workLocation: 'Dubai HQ',
      workingSchedule: 'Standard Mon-Fri',
      components: [
        { type: 'Salary', name: 'Basic Salary', amount: 15000, currency: 'AED', frequency: 'Monthly', isTaxable: true },
        { type: 'Allowance', name: 'Housing Allowance', amount: 6000, currency: 'AED', frequency: 'Monthly', isTaxable: true },
        { type: 'Allowance', name: 'Transportation Allowance', amount: 2000, currency: 'AED', frequency: 'Monthly', isTaxable: true },
      ],
    });
    assert('POST /offers creates offer successfully (201)', createOfferRes.status === 201);
    const offerId = typeof createOfferRes.body === 'string' ? createOfferRes.body : createOfferRes.body?.id;
    assert('Offer has generated ID', !!offerId);
    if (offerId) createdOfferIds.push(offerId);

    // 6. Offer Detail Retrieval
    console.log('\n--- Step 6: Offer Detail Retrieval ---');
    const getOfferRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/offers/${offerId}`, method: 'GET',
      headers: { Cookie: orgAAdmin.cookie },
    });
    assert('GET /offers/:id returns 200', getOfferRes.status === 200);
    createdOffer = getOfferRes.body;
    assert('Offer has atomic code sequence OFF-YYYY-NNNN', /^OFF-\d{4}-\d{3,}$/.test(createdOffer?.offerCode || ''));
    assert('GET /offers/:id returns versions', createdOffer?.versions?.length >= 1);
    assert('GET /offers/:id version 1 has 3 components', createdOffer?.versions?.[0]?.components?.length === 3);
    assert('GET /offers/:id version 1 monthlyPackage = 23000', createdOffer?.versions?.[0]?.monthlyPackage === 23000);
    assert('GET /offers/:id response payload is safe', isSafe(createdOffer));

    // 7. Offer Revisions
    console.log('\n--- Step 7: Offer Revisions ---');
    const revisionRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/offers/${offerId}/revisions`, method: 'POST',
      headers: { Cookie: orgAAdmin.cookie },
    }, {
      contractType: 'Permanent',
      probationPeriod: '3 Months',
      workLocation: 'Abu Dhabi Branch',
      components: [
        { type: 'Salary', name: 'Basic Salary', amount: 16000, currency: 'AED', frequency: 'Monthly', isTaxable: true },
        { type: 'Allowance', name: 'Housing Allowance', amount: 7000, currency: 'AED', frequency: 'Monthly', isTaxable: true },
        { type: 'Allowance', name: 'Transportation Allowance', amount: 2000, currency: 'AED', frequency: 'Monthly', isTaxable: true },
      ],
    });
    assert('POST /offers/:id/revisions returns 201', revisionRes.status === 201);
    const revisionId = typeof revisionRes.body === 'string' ? revisionRes.body : revisionRes.body?.id;
    assert('Revision created with ID', !!revisionId);

    // Refresh offer to verify revision
    const refreshedOfferRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/offers/${offerId}`, method: 'GET',
      headers: { Cookie: orgAAdmin.cookie },
    });
    const latestVersion = refreshedOfferRes.body?.versions?.[0];
    assert('Revision has versionNumber 2', latestVersion?.versionNumber === 2);
    assert('Revision has monthlyPackage 25000', latestVersion?.monthlyPackage === 25000);

    // 8. Offer Approval Inbox
    console.log('\n--- Step 8: Offer Approval Inbox ---');
    const offerInboxRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/offers/approvals/inbox', method: 'GET',
      headers: { Cookie: orgAAdmin.cookie },
    });
    assert('GET /offers/approvals/inbox returns 200', offerInboxRes.status === 200);
    assert('GET /offers/approvals/inbox returns array', Array.isArray(offerInboxRes.body));
    const targetApprovalId = latestVersion?.approvals?.[0]?.id;
    const pendingOfferApproval = offerInboxRes.body.find((item) => item.id === targetApprovalId || item.offerId === offerId);
    assert('Pending offer approval present in inbox', !!pendingOfferApproval);

    // 9. Blocking Unapproved Offer From Being Sent
    console.log('\n--- Step 9: Blocking Unapproved Offer Distribution ---');
    const prematureSendRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/offers/${offerId}/status`, method: 'PATCH',
      headers: { Cookie: orgAAdmin.cookie },
    }, { status: 'Sent' });
    assert('PATCH /offers/:id/status to Sent fails when unapproved (400/409)', prematureSendRes.status === 400 || prematureSendRes.status === 409);

    // 10. Deciding Offer Approval
    console.log('\n--- Step 10: Approving Offer Package ---');
    const decideOfferRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/offers/approvals/${targetApprovalId}/decide`, method: 'POST',
      headers: { Cookie: orgAAdmin.cookie },
    }, { decision: 'Approve', comment: 'Compensation approved within band.' });
    assert('POST /offers/approvals/:id/decide returns 200/201', decideOfferRes.status === 200 || decideOfferRes.status === 201);

    // Verify offer status is now Approved
    const updatedOfferRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/offers/${offerId}`, method: 'GET',
      headers: { Cookie: orgAAdmin.cookie },
    });
    assert('Offer status transitioned to Approved', updatedOfferRes.body?.status === 'Approved');

    // 11. Sending Approved Offer
    console.log('\n--- Step 11: Sending Approved Offer ---');
    const sendOfferRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/offers/${offerId}/status`, method: 'PATCH',
      headers: { Cookie: orgAAdmin.cookie },
    }, { status: 'Sent' });
    assert('PATCH /offers/:id/status to Sent succeeds (200)', sendOfferRes.status === 200);

    // 12. Candidate Acceptance
    console.log('\n--- Step 12: Candidate Offer Acceptance ---');
    const acceptOfferRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/offers/${offerId}/status`, method: 'PATCH',
      headers: { Cookie: orgAAdmin.cookie },
    }, { status: 'Accepted' });
    assert('PATCH /offers/:id/status to Accepted succeeds (200)', acceptOfferRes.status === 200);

    // 13. Hiring Case Creation
    console.log('\n--- Step 13: Hiring Case Creation & Default Compliance Checklist ---');
    const createHireRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/hiring', method: 'POST',
      headers: { Cookie: orgAAdmin.cookie },
    }, { offerId });
    assert('POST /hiring creates hiring case (201)', createHireRes.status === 201);
    createdHiringCase = createHireRes.body;
    const hiringCaseId = createdHiringCase?.id;
    if (hiringCaseId) createdHiringCaseIds.push(hiringCaseId);
    assert('Hiring case has generated ID', !!hiringCaseId);
    assert('Hiring case status is Pending Compliance', createdHiringCase?.status === 'Pending Compliance');

    // 14. Hiring Case Detail & Compliance Requirements
    console.log('\n--- Step 14: Compliance Checklist Inspection ---');
    const getHireRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/hiring/${hiringCaseId}`, method: 'GET',
      headers: { Cookie: orgAAdmin.cookie },
    });
    assert('GET /hiring/:id returns 200', getHireRes.status === 200);
    const requirements = getHireRes.body?.complianceRequirements || [];
    assert('Hiring case has auto-generated compliance requirements (>= 2)', requirements.length >= 2);
    assert('GET /hiring/:id payload is safe', isSafe(getHireRes.body));

    // 15. Blocking Final Approval Submission When Compliance Pending
    console.log('\n--- Step 15: Blocking Final Approval When Compliance Incomplete ---');
    const prematureSubmitRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/hiring/${hiringCaseId}/submit`, method: 'POST',
      headers: { Cookie: orgAAdmin.cookie },
    });
    assert('POST /hiring/:id/submit fails when requirements not verified (400/409)', prematureSubmitRes.status === 400 || prematureSubmitRes.status === 409);

    // 16. Verifying Compliance Checklist Items
    console.log('\n--- Step 16: Verifying Compliance Requirements ---');
    for (const req of requirements) {
      const patchReqRes = await request({
        hostname: 'localhost', port: 3000,
        path: `/api/v1/hiring/${hiringCaseId}/compliance/${req.id}`, method: 'PATCH',
        headers: { Cookie: orgAAdmin.cookie },
      }, { status: 'Verified' });
      assert(`PATCH /hiring/:id/compliance/:reqId to Verified (${req.name})`, patchReqRes.status === 200);
    }

    // 17. Submitting for Final Approval
    console.log('\n--- Step 17: Submitting for Final Approval ---');
    const submitHireRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/hiring/${hiringCaseId}/submit`, method: 'POST',
      headers: { Cookie: orgAAdmin.cookie },
    });
    assert('POST /hiring/:id/submit succeeds after compliance completion (200/201)', submitHireRes.status === 200 || submitHireRes.status === 201);

    // 18. Final Approval Inbox & Decision
    console.log('\n--- Step 18: Final Approval Inbox & Decision ---');
    const finalInboxRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/hiring/final-approvals', method: 'GET',
      headers: { Cookie: orgAAdmin.cookie },
    });
    assert('GET /hiring/final-approvals returns 200', finalInboxRes.status === 200);
    const foundFinalCase = finalInboxRes.body?.find((c) => c.id === hiringCaseId);
    assert('Submitted hiring case appears in final approval inbox', !!foundFinalCase);

    const grantFinalApprovalRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/hiring/${hiringCaseId}/final-approval`, method: 'POST',
      headers: { Cookie: orgAAdmin.cookie },
    }, { decision: 'Approve', comment: 'Executive authorization granted for employment.' });
    assert('POST /hiring/:id/final-approval succeeds (200/201)', grantFinalApprovalRes.status === 200 || grantFinalApprovalRes.status === 201);

    // Check status is now Awaiting Joining
    const awaitingHireRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/hiring/${hiringCaseId}`, method: 'GET',
      headers: { Cookie: orgAAdmin.cookie },
    });
    assert('Hiring case status is Awaiting Joining', awaitingHireRes.body?.status === 'Awaiting Joining');

    // 19. Confirming Joining & Atomic Vacancy Headcount Updates
    console.log('\n--- Step 19: Confirming Joining & Vacancy Headcount Verification ---');
    const confirmJoiningRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/hiring/${hiringCaseId}/joining`, method: 'POST',
      headers: { Cookie: orgAAdmin.cookie },
    }, { status: 'Joined', actualJoiningDate: new Date().toISOString() });
    assert('POST /hiring/:id/joining returns 200/201', confirmJoiningRes.status === 200 || confirmJoiningRes.status === 201);

    // Verify hiring case status is Joined
    const joinedHireRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/hiring/${hiringCaseId}`, method: 'GET',
      headers: { Cookie: orgAAdmin.cookie },
    });
    assert('Hiring case status is Joined', joinedHireRes.body?.status === 'Joined');

    // Verify vacancy joinedHeadcount atomically incremented in DB
    const refreshedVacancy = await prisma.vacancy.findUnique({ where: { id: testVacancy.id } });
    assert(`Vacancy joinedHeadcount atomically incremented from ${initialJoinedCount} to ${initialJoinedCount + 1}`, refreshedVacancy?.joinedHeadcount === initialJoinedCount + 1);

    // Verify candidate application stage transitioned to Joined
    const refreshedApplication = await prisma.application.findUnique({ where: { id: testApplication.id } });
    assert('Candidate Application stage transitioned to Joined', refreshedApplication?.stage === 'Joined');

    const duplicateJoiningRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/hiring/${hiringCaseId}/joining`, method: 'POST',
      headers: { Cookie: orgAAdmin.cookie },
    }, { status: 'Joined', actualJoiningDate: new Date().toISOString() });
    const afterDuplicateVacancy = await prisma.vacancy.findUnique({ where: { id: testVacancy.id } });
    const afterDuplicateHire = await prisma.hiringCase.findUnique({ where: { id: hiringCaseId } });
    assert(
      'Repeated joining confirmation is rejected without double counting',
      duplicateJoiningRes.status === 400 &&
        afterDuplicateVacancy?.joinedHeadcount === initialJoinedCount + 1 &&
        afterDuplicateHire?.status === 'Joined',
    );

    const fullCapacityCandidateRecord = await prisma.candidate.create({
      data: {
        organizationId: orgAAdminRecord.organizationId,
        candidateCode: `CND-TEST-${fixtureToken}`,
        firstName: 'Full',
        lastName: 'Capacity',
        email: `full.capacity.${fixtureToken}@example.com`,
        phone: '+971501928375',
        currentTitle: 'Capacity Test Candidate',
        source: 'P5.5 acceptance test',
      },
    });
    fullCapacityCandidate = fullCapacityCandidateRecord;
    createdCandidateIds.push(fullCapacityCandidateRecord.id);

    fullCapacityApplication = await prisma.application.create({
      data: {
        organizationId: orgAAdminRecord.organizationId,
        applicationCode: `APP-TEST-${fixtureToken}`,
        vacancyId: testVacancy.id,
        candidateId: fullCapacityCandidateRecord.id,
        stage: 'Pre-Hire',
        source: 'P5.5 acceptance test',
        primaryRecruiterId: orgAAdminRecord.id,
        taskOwnerId: orgAAdminRecord.id,
      },
    });
    createdApplicationIds.push(fullCapacityApplication.id);

    fullCapacityOffer = await prisma.offer.create({
      data: {
        organizationId: orgAAdminRecord.organizationId,
        applicationId: fullCapacityApplication.id,
        offerCode: `OFF-TEST-${fixtureToken}`,
        status: 'Accepted',
      },
    });
    createdOfferIds.push(fullCapacityOffer.id);

    const fullCapacityVersion = await prisma.offerVersion.create({
      data: {
        offerId: fullCapacityOffer.id,
        versionNumber: 1,
        approvalStatus: 'Approved',
        isLocked: true,
      },
    });
    await prisma.offer.update({
      where: { id: fullCapacityOffer.id },
      data: { currentVersionId: fullCapacityVersion.id },
    });

    fullCapacityHiringCase = await prisma.hiringCase.create({
      data: {
        organizationId: orgAAdminRecord.organizationId,
        applicationId: fullCapacityApplication.id,
        offerId: fullCapacityOffer.id,
        status: 'Awaiting Joining',
        ownerUserId: orgAAdminRecord.id,
      },
    });
    createdHiringCaseIds.push(fullCapacityHiringCase.id);

    const fullCapacityJoiningRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/hiring/${fullCapacityHiringCase.id}/joining`, method: 'POST',
      headers: { Cookie: orgAAdmin.cookie },
    }, { status: 'Joined', actualJoiningDate: new Date().toISOString() });
    const afterFullCapacityVacancy = await prisma.vacancy.findUnique({ where: { id: testVacancy.id } });
    const afterFullCapacityHire = await prisma.hiringCase.findUnique({ where: { id: fullCapacityHiringCase.id } });
    const afterFullCapacityApplication = await prisma.application.findUnique({ where: { id: fullCapacityApplication.id } });
    assert(
      'Full vacancy joining is rejected without state changes',
      fullCapacityJoiningRes.status === 400 &&
        afterFullCapacityVacancy?.joinedHeadcount === afterDuplicateVacancy?.joinedHeadcount &&
        afterFullCapacityHire?.status === 'Awaiting Joining' &&
        afterFullCapacityApplication?.stage === 'Pre-Hire',
    );

    // 20. Cross-Tenant Isolation
    console.log('\n--- Step 20: Cross-Tenant Isolation ---');
    const orgBCrossOfferRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/offers/${offerId}`, method: 'GET',
      headers: { Cookie: orgBAdmin.cookie },
    });
    assert('Org B cannot access Org A offer (Safe 404)', orgBCrossOfferRes.status === 404);
    assert('Org B safe disclosure on offer lookup', isSafe(orgBCrossOfferRes.body));

    const orgBCrossHireRes = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1/hiring/${hiringCaseId}`, method: 'GET',
      headers: { Cookie: orgBAdmin.cookie },
    });
    assert('Org B cannot access Org A hiring case (Safe 404)', orgBCrossHireRes.status === 404);
    assert('Org B safe disclosure on hiring case lookup', isSafe(orgBCrossHireRes.body));

    // 21. UUID Validation
    console.log('\n--- Step 21: UUID Route Parameter Validation ---');
    const invalidOfferUuidRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/offers/not-a-valid-uuid', method: 'GET',
      headers: { Cookie: orgAAdmin.cookie },
    });
    assert('GET /offers/not-a-valid-uuid returns 400 Bad Request', invalidOfferUuidRes.status === 400);

    const invalidHireUuidRes = await request({
      hostname: 'localhost', port: 3000,
      path: '/api/v1/hiring/not-a-valid-uuid', method: 'GET',
      headers: { Cookie: orgAAdmin.cookie },
    });
    assert('GET /hiring/not-a-valid-uuid returns 400 Bad Request', invalidHireUuidRes.status === 400);

  } catch (err) {
    console.error('Unexpected error during test execution:', err);
    failed++;
  } finally {
    // 22. Clean Teardown
    console.log('\n--- Step 22: Teardown Test Fixtures ---');
    try {
      for (const hid of createdHiringCaseIds) {
        await prisma.hiringCaseApproval.deleteMany({ where: { hiringCaseId: hid } }).catch(() => {});
        await prisma.complianceRequirement.deleteMany({ where: { hiringCaseId: hid } }).catch(() => {});
        await prisma.hiringCase.deleteMany({ where: { id: hid } }).catch(() => {});
      }
      for (const oid of createdOfferIds) {
        const versions = await prisma.offerVersion.findMany({ where: { offerId: oid } });
        for (const v of versions) {
          await prisma.offerApproval.deleteMany({ where: { offerVersionId: v.id } }).catch(() => {});
          await prisma.offerComponent.deleteMany({ where: { offerVersionId: v.id } }).catch(() => {});
        }
        await prisma.offerVersion.deleteMany({ where: { offerId: oid } }).catch(() => {});
        await prisma.offer.deleteMany({ where: { id: oid } }).catch(() => {});
      }
      for (const aid of createdApplicationIds) {
        await prisma.applicationStatusHistory.deleteMany({ where: { applicationId: aid } }).catch(() => {});
        await prisma.application.deleteMany({ where: { id: aid } }).catch(() => {});
      }
      for (const cid of createdCandidateIds) {
        await prisma.candidate.deleteMany({ where: { id: cid } }).catch(() => {});
      }
      for (const vid of createdVacancyIds) {
        await prisma.vacancy.deleteMany({ where: { id: vid } }).catch(() => {});
      }
      for (const rid of createdVacancyRequestIds) {
        await prisma.vacancyRequest.deleteMany({ where: { id: rid } }).catch(() => {});
      }
      console.log('Test fixtures cleaned up successfully.');
    } catch (cleanErr) {
      console.warn('Warning during teardown:', cleanErr.message);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`P5.5 Offers & Hiring Suite Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('='.repeat(70));

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
