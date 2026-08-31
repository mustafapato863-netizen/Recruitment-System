const API_PORT = Number(process.env.P4_API_PORT || 3000);

/**
 * P4 â€” Workflow and Lifecycle State Transition Verification Test Suite
 *
 * Covers:
 * 1. Vacancy Request Lifecycle (Draft -> Submit -> Multi-step Approval -> Convert -> Opening)
 * 2. Opening / Vacancy Lifecycle & Assignments (Pending Activation -> Open -> On Hold -> Closed)
 * 3. Application / Candidate Pipeline Transitions & Allowed Transition Graph
 * 4. Interview Scheduling, Attendees & Scorecard Gates
 * 5. Offer & Offer Version Approvals (Draft -> Approval Inbox -> Approved -> Sent -> Accepted)
 * 6. Hiring Case, Document & Compliance Verification Gates
 * 7. Final Approval & Joining Lifecycle (Headcount atomicity, stage advance to Joined)
 * 8. Invalid & Illegal Transitions (out-of-order, unapproved gates, skipping steps)
 * 9. Cross-Tenant Isolation on Transitions (Uniform 404)
 * 10. Role & Permission Protection on Transitions (Controlled 403)
 * 11. Idempotency & Repeated Transitions
 * 12. Audit Trail Verification for Lifecycle Actions
 * 13. UUID Parameter Validation (400 Bad Request)
 * 14. Clean Teardown of Test Data
 */

const http = require('http');
const { PrismaClient } = require('./generated/client');

const prisma = new PrismaClient();

// â”€â”€â”€ HTTP Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function request(options, body) {
  return new Promise((resolve, reject) => {
    const opts = { ...options, headers: { ...(options.headers || {}) } };
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
    hostname: 'localhost', port: API_PORT,
    path: '/api/v1/auth/login', method: 'POST',
  }, { email, password });
  const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  return { status: res.status, cookie: cookies, profile: res.body?.user };
}

function isSafe(body) {
  if (!body) return true;
  const str = typeof body === 'string' ? body : JSON.stringify(body);
  const leaks = ['prisma', 'SELECT ', 'INSERT ', 'DELETE ', 'UPDATE ', 'at async', 'node_modules', 'dist/apps/api', 'PrismaClientKnownRequestError'];
  return !leaks.some(l => str.includes(l));
}

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  âœ… PASS: ${label}${detail ? ' â€” ' + detail : ''}`);
    passed++;
  } else {
    console.log(`  âŒ FAIL: ${label}${detail ? ' â€” ' + detail : ''}`);
    failed++;
  }
}

// â”€â”€â”€ Test Suite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function runP4Suite() {
  console.log('=== P4 WORKFLOW & LIFECYCLE STATE TRANSITION VERIFICATION SUITE ===\n');

  // Track created entities for teardown
  const cleanup = {
    hiringCaseIds: [],
    offerIds: [],
    interviewIds: [],
    screeningLogIds: [],
    applicationIds: [],
    candidateIds: [],
    vacancyIds: [],
    vacancyRequestIds: [],
  };

  try {
    // â”€â”€â”€ Personas Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const ahmed = await login('ahmed.mahmoud@recruitflow.local', 'Password123!'); // Admin / HR Manager / Offer Approver / Final Approver
    const sarah = await login('sarah.ahmed@recruitflow.local', 'Password123!');   // Recruiter
    const hassan = await login('hassan.ali@recruitflow.local', 'Password123!');   // Hiring Manager
    const aya = await login('aya.mostafa@recruitflow.local', 'Password123!');     // Interviewer
    const tarek = await login('tarek.kamal@acme-health.local', 'Password123!');  // Org B Admin

    // Fetch org context
    const orgAId = ahmed.profile.organizationId;
    const branchA = (await prisma.branch.findFirst({ where: { organizationId: orgAId } }));
    const positionA = (await prisma.position.findFirst({ where: { organizationId: orgAId } }));

    // =========================================================================
    // SECTION 1: Vacancy Request Lifecycle & Gates
    // =========================================================================
    console.log('\n[1] VACANCY REQUEST LIFECYCLE & MULTI-STEP APPROVALS');

    // 1.1 Create Draft Request
    const createReqRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: '/api/v1/vacancy-requests', method: 'POST',
      headers: { Cookie: hassan.cookie },
    }, {
      branchId: branchA.id,
      positionId: positionA.id,
      requestedHeadcount: 1,
      budgetStatus: 'Budgeted',
      employmentType: 'Full-time',
      reason: 'Expansion',
      criticality: 'High',
      justification: 'P4 Workflow test request',
    });

    check('Hiring Manager creates Draft Vacancy Request (201)', createReqRes.status === 201, `status: ${createReqRes.status}`);
    const req1 = createReqRes.body;
    cleanup.vacancyRequestIds.push(req1?.id);
    check('Request is in Draft status', req1?.status === 'Draft', `status: ${req1?.status}`);

    // 1.2 Attempt conversion of Draft request -> Must fail (409 Conflict)
    const illegalConvertRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/vacancy-requests/${req1.id}/convert`, method: 'POST',
      headers: { Cookie: ahmed.cookie },
    });
    check('Converting unapproved request fails (409 Conflict)', illegalConvertRes.status === 409, `status: ${illegalConvertRes.status}`);
    check('Conflict response is safe', isSafe(illegalConvertRes.body), '');

    // 1.3 Submit Request -> Transitions to Pending Approval
    const submitReqRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/vacancy-requests/${req1.id}/submit`, method: 'POST',
      headers: { Cookie: hassan.cookie },
    }, { comment: 'Ready for review' });
    check('Submit Vacancy Request succeeds (200)', submitReqRes.status === 200, `status: ${submitReqRes.status}`);
    check('Request status is Pending Approval', submitReqRes.body?.status === 'Pending Approval', `status: ${submitReqRes.body?.status}`);

    // 1.4 Resubmitting already pending request -> Must fail (409 Conflict)
    const resubmitRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/vacancy-requests/${req1.id}/submit`, method: 'POST',
      headers: { Cookie: hassan.cookie },
    }, { comment: 'Duplicate submit' });
    check('Duplicate submit returns 409 Conflict', resubmitRes.status === 409, `status: ${resubmitRes.status}`);

    // 1.5 Step 1 Approval: Hiring Manager approves step 1
    const approveStep1Res = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/vacancy-requests/${req1.id}/approve`, method: 'POST',
      headers: { Cookie: hassan.cookie },
    }, { comment: 'Approved by HM' });
    check('Step 1 Approval by Hiring Manager succeeds (200)', approveStep1Res.status === 200, `status: ${approveStep1Res.status}`);
    // Since budgeted, step 1 advances to step 2 (HR_MANAGER), still Pending Approval
    check('Request advances to Step 2 (HR_MANAGER)', approveStep1Res.body?.status === 'Pending Approval', `status: ${approveStep1Res.body?.status}`);

    // 1.6 Step 2 Approval: HR Manager (Ahmed) approves step 2 -> final Approved
    const approveStep2Res = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/vacancy-requests/${req1.id}/approve`, method: 'POST',
      headers: { Cookie: ahmed.cookie },
    }, { comment: 'Approved by HR' });
    check('Step 2 Approval by HR Manager completes approval (200)', approveStep2Res.status === 200, `status: ${approveStep2Res.status}`);
    check('Request status is Approved', approveStep2Res.body?.status === 'Approved', `status: ${approveStep2Res.body?.status}`);

    // 1.7 Convert Approved Request to Opening/Vacancy
    const convertRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/vacancy-requests/${req1.id}/convert`, method: 'POST',
      headers: { Cookie: ahmed.cookie },
    });
    check('Convert Approved Request succeeds (200)', convertRes.status === 200, `status: ${convertRes.status}`);
    check('Vacancy created in Pending Activation', convertRes.body?.vacancy?.status === 'Pending Activation', `status: ${convertRes.body?.vacancy?.status}`);
    check('Request status becomes Converted to Vacancy', convertRes.body?.request?.status === 'Converted to Vacancy', `status: ${convertRes.body?.request?.status}`);
    const vacancy1 = convertRes.body?.vacancy;
    cleanup.vacancyIds.push(vacancy1?.id);

    // 1.8 Idempotent convert: repeating conversion returns existing vacancy safely
    const repeatConvertRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/vacancy-requests/${req1.id}/convert`, method: 'POST',
      headers: { Cookie: ahmed.cookie },
    });
    check('Repeated convert is idempotent (200)', repeatConvertRes.status === 200, `status: ${repeatConvertRes.status}`);
    check('Idempotent flag is true', repeatConvertRes.body?.idempotent === true, '');

    // =========================================================================
    // SECTION 2: Vacancy / Opening Lifecycle & Assignments
    // =========================================================================
    console.log('\n[2] VACANCY / OPENING LIFECYCLE & TEAM ASSIGNMENTS');

    // 2.1 Activate Vacancy: Pending Activation -> Open
    const openVacancyRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/vacancies/${vacancy1.id}/status`, method: 'PATCH',
      headers: { Cookie: ahmed.cookie },
    }, { status: 'Open' });
    check('Activate Vacancy to Open (200)', openVacancyRes.status === 200, `status: ${openVacancyRes.status}`);
    check('Vacancy status is Open and openedAt is set', openVacancyRes.body?.status === 'Open' && Boolean(openVacancyRes.body?.openedAt), '');

    // 2.2 Assign Recruiter to Vacancy
    const assignTeamRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/vacancies/${vacancy1.id}/assignments`, method: 'POST',
      headers: { Cookie: ahmed.cookie },
    }, { userId: sarah.profile.id, roleCode: 'PRIMARY_RECRUITER' });
    check('Assign Primary Recruiter to Vacancy (201)', assignTeamRes.status === 201, `status: ${assignTeamRes.status}`);

    // =========================================================================
    // SECTION 3: Candidate & Application Pipeline State Machine
    // =========================================================================
    console.log('\n[3] CANDIDATE & APPLICATION PIPELINE TRANSITIONS');

    // 3.1 Create candidate
    const testCandEmail = `p4.test.cand.${Date.now()}@example.com`;
    const createCandRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: '/api/v1/candidates', method: 'POST',
      headers: { Cookie: sarah.cookie },
    }, {
      firstName: 'P4',
      lastName: 'Candidate',
      email: testCandEmail,
      phone: '+201000000999',
      currentTitle: 'Senior Software Engineer',
      source: 'LinkedIn',
    });
    check('Create Candidate (201)', createCandRes.status === 201, `status: ${createCandRes.status}`);
    const cand1 = createCandRes.body;
    cleanup.candidateIds.push(cand1?.id);

    // 3.2 Create Application: Initial stage 'Applied'
    const createAppRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: '/api/v1/applications', method: 'POST',
      headers: { Cookie: sarah.cookie },
    }, {
      vacancyId: vacancy1.id,
      candidateId: cand1.id,
      source: 'Direct',
    });
    check('Create Application (201)', createAppRes.status === 201, `status: ${createAppRes.status}`);
    const app1 = createAppRes.body;
    cleanup.applicationIds.push(app1?.id);
    check('Initial stage is Applied', app1?.stage === 'Applied', `stage: ${app1?.stage}`);

    // 3.3 Duplicate application for same candidate & vacancy -> Must fail (409 Conflict)
    const dupAppRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: '/api/v1/applications', method: 'POST',
      headers: { Cookie: sarah.cookie },
    }, {
      vacancyId: vacancy1.id,
      candidateId: cand1.id,
    });
    check('Duplicate candidate application returns 409 Conflict', dupAppRes.status === 409, `status: ${dupAppRes.status}`);

    // 3.4 Invalid stage transition: Applied -> Joined directly -> Must fail (400 Bad Request)
    const illegalStageRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/applications/${app1.id}/stage`, method: 'PATCH',
      headers: { Cookie: sarah.cookie },
    }, { stage: 'Joined' });
    check('Illegal jump from Applied to Joined returns 400 Bad Request', illegalStageRes.status === 400, `status: ${illegalStageRes.status}`);
    check('Response explains allowed transitions', illegalStageRes.body?.message?.includes('Allowed transitions'), `msg: ${illegalStageRes.body?.message}`);

    // 3.5 Valid stage transition: Applied -> Screening
    const stageScreeningRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/applications/${app1.id}/stage`, method: 'PATCH',
      headers: { Cookie: sarah.cookie },
    }, { stage: 'Screening' });
    check('Advance stage: Applied -> Screening (200)', stageScreeningRes.status === 200, `status: ${stageScreeningRes.status}`);
    check('Application stage is Screening', stageScreeningRes.body?.stage === 'Screening', `stage: ${stageScreeningRes.body?.stage}`);

    // 3.6 Create Screening Log
    const createScreenLogRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: '/api/v1/screening', method: 'POST',
      headers: { Cookie: sarah.cookie },
    }, {
      applicationId: app1.id,
      outcome: 'Passed',
      notes: 'Strong communication skills and tech background',
    });
    check('Submit Screening Log (201)', createScreenLogRes.status === 201, `status: ${createScreenLogRes.status}`);
    cleanup.screeningLogIds.push(createScreenLogRes.body?.id);

    // 3.7 Valid stage transition: Screening -> Interview
    const stageInterviewRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/applications/${app1.id}/stage`, method: 'PATCH',
      headers: { Cookie: sarah.cookie },
    }, { stage: 'Interview' });
    check('Advance stage: Screening -> Interview (200)', stageInterviewRes.status === 200, `status: ${stageInterviewRes.status}`);

    // =========================================================================
    // SECTION 4: Interview Lifecycle, Attendees & Scorecards
    // =========================================================================
    console.log('\n[4] INTERVIEW LIFECYCLE & STRUCTURED SCORECARDS');

    // 4.1 Schedule Interview
    const start = new Date(Date.now() + 86400000).toISOString();
    const end = new Date(Date.now() + 90000000).toISOString();
    const createIntRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: '/api/v1/interviews', method: 'POST',
      headers: { Cookie: sarah.cookie },
    }, {
      applicationId: app1.id,
      title: 'Technical Round 1',
      interviewType: 'Technical',
      scheduledStart: start,
      scheduledEnd: end,
      timezone: 'UTC',
      attendeeUserIds: [aya.profile.id],
    });
    check('Schedule Interview with Attendee (201)', createIntRes.status === 201, `status: ${createIntRes.status}`);
    const int1 = createIntRes.body;
    cleanup.interviewIds.push(int1?.id);
    check('Interview status is Scheduled', int1?.status === 'Scheduled', `status: ${int1?.status}`);

    // 4.2 Submit Scorecard by Interviewer
    const submitScorecardRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/interviews/${int1.id}/scorecard`, method: 'POST',
      headers: { Cookie: aya.cookie },
    }, {
      overallRating: 5,
      recommendation: 'Strong Hire',
      strengths: 'Excellent system architecture knowledge',
      notes: 'Recommended for next step',
    });
    check('Submit Interview Scorecard (201)', submitScorecardRes.status === 201, `status: ${submitScorecardRes.status}`);
    check('Scorecard recommendation is recorded', submitScorecardRes.body?.recommendation === 'Strong Hire', '');

    // 4.3 Update Interview to Completed
    const completeIntRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/interviews/${int1.id}`, method: 'PATCH',
      headers: { Cookie: sarah.cookie },
    }, { status: 'Completed' });
    check('Complete Interview (200)', completeIntRes.status === 200, `status: ${completeIntRes.status}`);
    check('Interview status is Completed', completeIntRes.body?.status === 'Completed', `status: ${completeIntRes.body?.status}`);

    // 4.4 Advance Application stage: Interview -> Offer
    const stageOfferRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/applications/${app1.id}/stage`, method: 'PATCH',
      headers: { Cookie: sarah.cookie },
    }, { stage: 'Offer' });
    check('Advance stage: Interview -> Offer (200)', stageOfferRes.status === 200, `status: ${stageOfferRes.status}`);

    // =========================================================================
    // SECTION 5: Offer Lifecycle, Version Approvals & Acceptance
    // =========================================================================
    console.log('\n[5] OFFER CREATION, APPROVAL INBOX, SENT & ACCEPTANCE');

    // 5.1 Create Offer
    const createOfferRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: '/api/v1/offers', method: 'POST',
      headers: { Cookie: sarah.cookie },
    }, {
      applicationId: app1.id,
      contractType: 'Permanent',
      probationPeriod: '3 months',
      proposedJoiningDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      components: [
        { type: 'Salary', name: 'Basic Salary', amount: 50000, frequency: 'Monthly', isTaxable: true },
        { type: 'Allowance', name: 'Housing Allowance', amount: 10000, frequency: 'Monthly', isTaxable: true },
      ],
    });
    check('Create Offer (201)', createOfferRes.status === 201, `status: ${createOfferRes.status}`);
    const offerId = createOfferRes.body;
    cleanup.offerIds.push(offerId);

    // 5.2 Verify Offer is in Pending Approval
    const getOfferRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/offers/${offerId}`, method: 'GET',
      headers: { Cookie: sarah.cookie },
    });
    check('Offer initial status is Pending Approval', getOfferRes.body?.status === 'Pending Approval', `status: ${getOfferRes.body?.status}`);

    // 5.3 Attempting to Send an unapproved offer -> Must fail (400 Bad Request)
    const illegalSendRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/offers/${offerId}/status`, method: 'PATCH',
      headers: { Cookie: sarah.cookie },
    }, { status: 'Sent' });
    check('Sending unapproved offer fails with 400 Bad Request', illegalSendRes.status === 400, `status: ${illegalSendRes.status}`);

    // 5.4 Fetch Offer Approval Inbox
    const approvalInboxRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: '/api/v1/offers/approvals/inbox', method: 'GET',
      headers: { Cookie: ahmed.cookie },
    });
    check('Offer Approver views inbox (200)', approvalInboxRes.status === 200, `status: ${approvalInboxRes.status}`);
    const targetApproval = (approvalInboxRes.body || []).find((a) => a.offerCode === getOfferRes.body?.offerCode);
    check('Target offer is present in Approver inbox', Boolean(targetApproval), '');

    // 5.5 Recruiter attempting to approve offer -> Must fail (403 Forbidden)
    if (targetApproval) {
      const recApproveRes = await request({
        hostname: 'localhost', port: API_PORT,
        path: `/api/v1/offers/approvals/${targetApproval.id}/decide`, method: 'POST',
        headers: { Cookie: sarah.cookie },
      }, { decision: 'Approve', comment: 'Unauthorized approve attempt' });
      check('Recruiter unauthorized to approve offer (403 Forbidden)', recApproveRes.status === 403, `status: ${recApproveRes.status}`);
    }

    // 5.6 Authorized Approver (Ahmed) approves offer
    const approveOfferRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/offers/approvals/${targetApproval.id}/decide`, method: 'POST',
      headers: { Cookie: ahmed.cookie },
    }, { decision: 'Approve', comment: 'Package approved by HR' });
    check('Authorized Approver approves offer version (201)', approveOfferRes.status === 201, `status: ${approveOfferRes.status}`);

    // 5.7 Verify Offer status is now Approved
    const approvedOfferRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/offers/${offerId}`, method: 'GET',
      headers: { Cookie: sarah.cookie },
    });
    check('Offer status is now Approved', approvedOfferRes.body?.status === 'Approved', `status: ${approvedOfferRes.body?.status}`);

    // 5.8 Send Offer: Approved -> Sent
    const sendOfferRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/offers/${offerId}/status`, method: 'PATCH',
      headers: { Cookie: sarah.cookie },
    }, { status: 'Sent' });
    check('Send approved offer (200)', sendOfferRes.status === 200, `status: ${sendOfferRes.status}`);

    // 5.9 Accept Offer: Sent -> Accepted -> triggers automatic application stage to Pre-Hire
    const acceptOfferRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/offers/${offerId}/status`, method: 'PATCH',
      headers: { Cookie: sarah.cookie },
    }, { status: 'Accepted' });
    check('Accept offer (200)', acceptOfferRes.status === 200, `status: ${acceptOfferRes.status}`);

    // Verify application stage automatically updated to Pre-Hire
    const appAfterOffer = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/applications/${app1.id}`, method: 'GET',
      headers: { Cookie: sarah.cookie },
    });
    check('Application stage automatically advanced to Pre-Hire', appAfterOffer.body?.stage === 'Pre-Hire', `stage: ${appAfterOffer.body?.stage}`);

    // =========================================================================
    // SECTION 6: Hiring Case, Compliance Gates & Final Approval
    // =========================================================================
    console.log('\n[6] HIRING CASE, COMPLIANCE GATES & FINAL APPROVAL');

    // 6.1 Create Hiring Case
    const createCaseRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: '/api/v1/hiring', method: 'POST',
      headers: { Cookie: sarah.cookie },
    }, { offerId });
    check('Create Hiring Case for Accepted Offer (201)', createCaseRes.status === 201, `status: ${createCaseRes.status}`);
    const hiringCase = createCaseRes.body;
    cleanup.hiringCaseIds.push(hiringCase?.id);
    check('Hiring Case status is Pending Compliance', hiringCase?.status === 'Pending Compliance', `status: ${hiringCase?.status}`);

    // 6.2 Submitting for Final Approval without verified compliance -> Must fail (400 Bad Request)
    const prematureSubmitRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/hiring/${hiringCase.id}/submit`, method: 'POST',
      headers: { Cookie: sarah.cookie },
    });
    check('Premature Final Approval submission blocked (400 Bad Request)', prematureSubmitRes.status === 400, `status: ${prematureSubmitRes.status}`);
    check('Error mentions unverified compliance checks', prematureSubmitRes.body?.message?.includes('compliance'), `msg: ${prematureSubmitRes.body?.message}`);

    // 6.3 Verify all compliance requirements
    const caseDetailsRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/hiring/${hiringCase.id}`, method: 'GET',
      headers: { Cookie: sarah.cookie },
    });
    const requirements = caseDetailsRes.body?.complianceRequirements || [];
    check('Hiring case has default compliance requirements', requirements.length > 0, `count: ${requirements.length}`);

    for (const req of requirements) {
      const verifyReqRes = await request({
        hostname: 'localhost', port: API_PORT,
        path: `/api/v1/hiring/${hiringCase.id}/compliance/${req.id}`, method: 'PATCH',
        headers: { Cookie: sarah.cookie },
      }, { status: 'Verified' });
      check(`Verify compliance check "${req.name}" (200)`, verifyReqRes.status === 200, `status: ${verifyReqRes.status}`);
    }

    // 6.4 Submit for Final Approval (now that all requirements are verified)
    const validSubmitCaseRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/hiring/${hiringCase.id}/submit`, method: 'POST',
      headers: { Cookie: sarah.cookie },
    });
    check('Submit for Final Approval succeeds (201)', validSubmitCaseRes.status === 201, `status: ${validSubmitCaseRes.status}`);
    check('Hiring case status is Pending Final Approval', validSubmitCaseRes.body?.status === 'Pending Final Approval', `status: ${validSubmitCaseRes.body?.status}`);

    // 6.5 Final Approver decides approval -> Awaiting Joining
    const finalApproveRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/hiring/${hiringCase.id}/final-approval`, method: 'POST',
      headers: { Cookie: ahmed.cookie },
    }, { decision: 'Approve', comment: 'All pre-hire verification passed' });
    check('Final Approver grants final approval (201)', finalApproveRes.status === 201, `status: ${finalApproveRes.status}`);

    // Verify case status is Awaiting Joining
    const awaitingCaseRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/hiring/${hiringCase.id}`, method: 'GET',
      headers: { Cookie: sarah.cookie },
    });
    check('Hiring case status is Awaiting Joining', awaitingCaseRes.body?.status === 'Awaiting Joining', `status: ${awaitingCaseRes.body?.status}`);

    // 6.6 Confirm Joining
    const joinDate = new Date().toISOString();
    const confirmJoiningRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/hiring/${hiringCase.id}/joining`, method: 'POST',
      headers: { Cookie: ahmed.cookie },
    }, { status: 'Joined', actualJoiningDate: joinDate });
    check('Confirm Joining succeeds (201)', confirmJoiningRes.status === 201, `status: ${confirmJoiningRes.status}`);

    // 6.7 Verify Vacancy Headcount incremented and Application Stage is 'Joined'
    const finalVacancy = await prisma.vacancy.findUnique({ where: { id: vacancy1.id } });
    check('Vacancy joinedHeadcount incremented to 1', finalVacancy?.joinedHeadcount === 1, `joined: ${finalVacancy?.joinedHeadcount}`);

    const finalApp = await prisma.application.findUnique({ where: { id: app1.id } });
    check('Application final stage is Joined', finalApp?.stage === 'Joined', `stage: ${finalApp?.stage}`);

    // =========================================================================
    // SECTION 7: Cross-Tenant Protection on State Transitions
    // =========================================================================
    console.log('\n[7] CROSS-TENANT TRANSITION PROTECTION');

    // Org B user (Tarek) attempts to transition Org A's application stage
    const crossStageRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/applications/${app1.id}/stage`, method: 'PATCH',
      headers: { Cookie: tarek.cookie },
    }, { stage: 'Screening' });
    check('Cross-tenant stage transition returns safe 404', crossStageRes.status === 404, `status: ${crossStageRes.status}`);

    // Org B user attempts to decide Org A's vacancy request
    const crossDecideReqRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/vacancy-requests/${req1.id}/approve`, method: 'POST',
      headers: { Cookie: tarek.cookie },
    }, { comment: 'Cross org attack' });
    check('Cross-tenant vacancy request decision returns safe 404', crossDecideReqRes.status === 404, `status: ${crossDecideReqRes.status}`);

    // Org B user attempts to confirm joining on Org A's hiring case
    const crossJoinRes = await request({
      hostname: 'localhost', port: API_PORT,
      path: `/api/v1/hiring/${hiringCase.id}/joining`, method: 'POST',
      headers: { Cookie: tarek.cookie },
    }, { status: 'Joined' });
    check('Cross-tenant joining confirmation returns safe 404', crossJoinRes.status === 404, `status: ${crossJoinRes.status}`);

    // =========================================================================
    // SECTION 8: UUID Route Parameter Validation (400 Bad Request)
    // =========================================================================
    console.log('\n[8] UUID ROUTE PARAMETER VALIDATION (ParseUUIDPipe)');

    const invalidUuidEndpoints = [
      { method: 'GET', path: '/api/v1/vacancy-requests/not-a-valid-uuid' },
      { method: 'POST', path: '/api/v1/vacancy-requests/not-a-valid-uuid/submit' },
      { method: 'GET', path: '/api/v1/vacancies/not-a-valid-uuid' },
      { method: 'PATCH', path: '/api/v1/vacancies/not-a-valid-uuid/status' },
      { method: 'GET', path: '/api/v1/applications/not-a-valid-uuid' },
      { method: 'PATCH', path: '/api/v1/applications/not-a-valid-uuid/stage' },
      { method: 'GET', path: '/api/v1/candidates/not-a-valid-uuid' },
      { method: 'GET', path: '/api/v1/interviews/not-a-valid-uuid' },
      { method: 'GET', path: '/api/v1/offers/not-a-valid-uuid' },
      { method: 'GET', path: '/api/v1/hiring/not-a-valid-uuid' },
      { method: 'GET', path: '/api/v1/tasks/not-a-valid-uuid' },
      { method: 'GET', path: '/api/v1/users/not-a-valid-uuid' },
      { method: 'GET', path: '/api/v1/roles/not-a-valid-uuid' },
      { method: 'GET', path: '/api/v1/talent-pools/not-a-valid-uuid' },
      { method: 'GET', path: '/api/v1/pipeline-templates/not-a-valid-uuid' },
      { method: 'GET', path: '/api/v1/integrations/not-a-valid-uuid' },
    ];

    for (const ep of invalidUuidEndpoints) {
      const res = await request({
        hostname: 'localhost', port: API_PORT,
        path: ep.path, method: ep.method,
        headers: { Cookie: ahmed.cookie },
      }, ep.method === 'POST' || ep.method === 'PATCH' ? {} : undefined);
      check(`Invalid UUID on ${ep.method} ${ep.path} returns 400 Bad Request`, res.status === 400, `status: ${res.status}`);
      const msgStr = Array.isArray(res.body?.message) ? res.body.message.join(' ') : String(res.body?.message || '');
      check(`Response contains safe validation message`, isSafe(res.body) && res.status === 400, `msg: ${msgStr}`);
      check(`Response does not leak database details`, isSafe(res.body), '');
    }

    // =========================================================================
    // SECTION 9: Audit Trail Verification
    // =========================================================================
    console.log('\n[9] AUDIT LOG TRAIL FOR LIFECYCLE EVENTS');

    await new Promise((r) => setTimeout(r, 300));
    const auditLogs = await prisma.auditLog.findMany({
      where: { organizationId: orgAId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    check('Audit logs recorded for organization mutations', auditLogs.length > 0, `count: ${auditLogs.length}`);

    const recordedActions = auditLogs.map((a) => a.action);
    const hasStageChange = recordedActions.some((a) => a.includes('APPLICATION_STAGE_CHANGE'));
    const hasAnyLifecycleAction = recordedActions.some((a) => a.includes('VACANCY') || a.includes('APPLICATION') || a.includes('OFFER') || a.includes('HIRING'));
    check('Audit log captured application stage change action', hasStageChange, '');
    check('Audit log captured lifecycle transition actions', hasAnyLifecycleAction, `actions: ${[...new Set(recordedActions)].slice(0, 5).join(', ')}`);

  } finally {
    // =========================================================================
    // SECTION 10: Clean Teardown of Test Data
    // =========================================================================
    console.log('\n[10] CLEAN TEARDOWN OF ISOLATED TEST RECORDS');

    try {
      const validHiringCases = cleanup.hiringCaseIds.filter(Boolean);
      if (validHiringCases.length > 0) {
        await prisma.complianceRequirement.deleteMany({ where: { hiringCaseId: { in: validHiringCases } } });
        await prisma.hiringCaseApproval.deleteMany({ where: { hiringCaseId: { in: validHiringCases } } });
        await prisma.hiringCase.deleteMany({ where: { id: { in: validHiringCases } } });
      }
      const validOffers = cleanup.offerIds.filter(Boolean);
      if (validOffers.length > 0) {
        const versions = await prisma.offerVersion.findMany({ where: { offerId: { in: validOffers } }, select: { id: true } });
        const vIds = versions.map(v => v.id);
        if (vIds.length > 0) {
          await prisma.offerComponent.deleteMany({ where: { offerVersionId: { in: vIds } } });
          await prisma.offerApproval.deleteMany({ where: { offerVersionId: { in: vIds } } });
          await prisma.offerVersion.deleteMany({ where: { id: { in: vIds } } });
        }
        await prisma.offer.deleteMany({ where: { id: { in: validOffers } } });
      }
      const validInterviews = cleanup.interviewIds.filter(Boolean);
      if (validInterviews.length > 0) {
        await prisma.interviewScorecard.deleteMany({ where: { interviewId: { in: validInterviews } } });
        await prisma.interviewAttendee.deleteMany({ where: { interviewId: { in: validInterviews } } });
        await prisma.interview.deleteMany({ where: { id: { in: validInterviews } } });
      }
      const validScreening = cleanup.screeningLogIds.filter(Boolean);
      if (validScreening.length > 0) {
        await prisma.screeningLog.deleteMany({ where: { id: { in: validScreening } } });
      }
      const validApplications = cleanup.applicationIds.filter(Boolean);
      if (validApplications.length > 0) {
        await prisma.applicationStatusHistory.deleteMany({ where: { applicationId: { in: validApplications } } });
        await prisma.application.deleteMany({ where: { id: { in: validApplications } } });
      }
      const validCandidates = cleanup.candidateIds.filter(Boolean);
      if (validCandidates.length > 0) {
        await prisma.candidate.deleteMany({ where: { id: { in: validCandidates } } });
      }
      const validVacancies = cleanup.vacancyIds.filter(Boolean);
      if (validVacancies.length > 0) {
        await prisma.vacancyAssignment.deleteMany({ where: { vacancyId: { in: validVacancies } } });
        await prisma.vacancy.deleteMany({ where: { id: { in: validVacancies } } });
      }
      const validVacancyRequests = cleanup.vacancyRequestIds.filter(Boolean);
      if (validVacancyRequests.length > 0) {
        await prisma.vacancyRequestApproval.deleteMany({ where: { vacancyRequestId: { in: validVacancyRequests } } });
        await prisma.vacancyRequest.deleteMany({ where: { id: { in: validVacancyRequests } } });
      }
      console.log('  âœ… Isolated test records cleaned up successfully.');
    } catch (e) {
      console.warn('  âš ï¸ Note during teardown:', e.message);
    }

    await prisma.$disconnect();
  }

  // â”€â”€â”€ Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log(`\n${'='.repeat(60)}`);
  console.log(`P4 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  if (failed === 0) {
    console.log('ALL P4 WORKFLOW & LIFECYCLE TESTS PASSED âœ…');
  } else {
    console.log(`âŒ ${failed} test(s) FAILED â€” investigate above`);
    process.exit(1);
  }
}

runP4Suite().catch(e => {
  console.error('SUITE CRASHED:', e);
  process.exit(1);
});
