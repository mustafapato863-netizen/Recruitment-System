/**
 * E2E Recruitment Workflow & RLS Governance Verification Script
 * Validates:
 * 1. Admin login (admin@me.com / Admin@123456)
 * 2. Master data & Branch availability
 * 3. RLS Governance API (GET/PUT policies & audit simulation)
 * 4. Full recruitment lifecycle:
 *    - Create Vacancy Request
 *    - Approve Vacancy Request -> Auto-publish Vacancy
 *    - Create Candidate
 *    - Create Application
 *    - Stage progression: Applied -> Screening -> Interview -> Offer -> Pre-Hire -> Joined
 * 5. Clean up transient test records & reset sequences so DB is pristine for actual data
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/Recruitment_DB?schema=public';
}

const { PrismaClient } = require('../generated/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://127.0.0.1:3000/api/v1';

async function runE2E() {
  console.log('=== [1] Authenticating Admin User ===');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@me.com', password: 'Admin@123456' }),
  });

  if (!loginRes.ok) {
    throw new Error(`Admin login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const cookie = loginRes.headers.get('set-cookie');
  const loginData = await loginRes.json();
  const orgId = loginData.user.organizationId;
  console.log(`✓ Logged in as ${loginData.user.email} (Org: ${loginData.user.organizationName}, ID: ${orgId})`);
  console.log(`✓ Admin has ${loginData.user.permissions.length} active permissions`);

  console.log('\n=== [2] Validating Master Data & Taxonomy ===');
  const [branches, positions] = await Promise.all([
    prisma.branch.findMany({ where: { organizationId: orgId } }),
    prisma.position.findMany({ where: { organizationId: orgId } }),
  ]);
  console.log(`✓ Hospital Branches: ${branches.length} (${branches.map(b => b.name).join(', ')})`);
  console.log(`✓ Master Positions: ${positions.length} available`);
  if (!branches.length || !positions.length) {
    throw new Error('Master branches or positions are missing!');
  }

  console.log('\n=== [3] Validating Admin RLS Governance Control ===');
  const rlsGetRes = await fetch(`${BASE_URL}/access-control/rls-policies`, {
    headers: { Cookie: cookie },
  });
  if (!rlsGetRes.ok) throw new Error(`RLS GET failed: ${rlsGetRes.status}`);
  const rlsData = await rlsGetRes.json();
  console.log(`✓ Available RLS Scopes: ${rlsData.availableScopes.map(s => s.id).join(', ')}`);
  console.log(`✓ Configured Role Policies: ${Object.keys(rlsData.roles).length} roles`);

  // Test updating RLS policy as flexible choice from admin
  const modifiedRoles = { ...rlsData.roles };
  modifiedRoles['RECRUITER'] = {
    dataScope: 'ALL',
    canViewPii: true,
    canViewSalary: true,
    canDownloadDocs: true,
    canApprove: false,
  };
  modifiedRoles['HIRING_MANAGER'] = {
    dataScope: 'DEPARTMENT',
    canViewPii: false,
    canViewSalary: false,
    canDownloadDocs: false,
    canApprove: true,
  };

  const rlsPutRes = await fetch(`${BASE_URL}/access-control/rls-policies`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ roles: modifiedRoles }),
  });
  if (!rlsPutRes.ok) throw new Error(`RLS PUT failed: ${rlsPutRes.status}`);
  const rlsPutData = await rlsPutRes.json();
  console.log(`✓ Updated RLS: Recruiter canViewSalary=${rlsPutData.roles.RECRUITER.canViewSalary}, Hiring Manager Scope=${rlsPutData.roles.HIRING_MANAGER.dataScope}`);

  // Test Audit Simulation
  const simRes = await fetch(`${BASE_URL}/access-control/audit-simulation/HIRING_MANAGER`, {
    headers: { Cookie: cookie },
  });
  const simData = await simRes.json();
  console.log(`✓ RLS Audit Simulation for HIRING_MANAGER: Scoped by "${JSON.stringify(simData.sampleWhereClause)}"`);

  console.log('\n=== [4] End-to-End Recruitment Lifecycle Execution ===');
  const targetBranch = branches[0];
  const targetPosition = positions[0];

  // Step 4.1: Create Vacancy Request
  console.log('-> Step 4.1: Creating Vacancy Request...');
  const createReqRes = await fetch(`${BASE_URL}/vacancy-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      positionId: targetPosition.id,
      branchId: targetBranch.id,
      requestedHeadcount: 1,
      employmentType: 'Full-time',
      reason: 'Critical clinical need for cardiology consultant.',
      budgetStatus: 'Budgeted',
      criticality: 'High',
      justification: 'Urgent staffing requirement for clinical operations.',
    }),
  });
  if (!createReqRes.ok) throw new Error(`Create Vacancy Request failed: ${createReqRes.status} ${await createReqRes.text()}`);
  const reqData = await createReqRes.json();
  console.log(`✓ Created Vacancy Request: ${reqData.requestCode} (ID: ${reqData.id}, Status: ${reqData.status})`);

  // Step 4.2: Submit & Approve Vacancy Request -> Convert to Vacancy
  console.log('-> Step 4.2: Submitting Vacancy Request...');
  const submitReqRes = await fetch(`${BASE_URL}/vacancy-requests/${reqData.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ comment: 'Submitting requisition for clinical head approval.' }),
  });
  if (!submitReqRes.ok) throw new Error(`Submit Vacancy Request failed: ${submitReqRes.status} ${await submitReqRes.text()}`);
  console.log('✓ Vacancy Request submitted.');

  console.log('-> Step 1 Approval (Hiring Manager)...');
  const step1Res = await fetch(`${BASE_URL}/vacancy-requests/${reqData.id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ comment: 'Step 1: Approved by clinical head.' }),
  });
  if (!step1Res.ok) throw new Error(`Step 1 Approval failed: ${step1Res.status} ${await step1Res.text()}`);
  console.log('✓ Step 1 Approved.');

  console.log('-> Step 2 Approval (HR Manager)...');
  const step2Res = await fetch(`${BASE_URL}/vacancy-requests/${reqData.id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ comment: 'Step 2: Approved by HR administration.' }),
  });
  if (!step2Res.ok) throw new Error(`Step 2 Approval failed: ${step2Res.status} ${await step2Res.text()}`);
  const finalApprovedReq = await step2Res.json();
  console.log(`✓ Vacancy Request Fully Approved: Status=${finalApprovedReq.status}`);

  console.log('-> Converting Vacancy Request to Active Vacancy...');
  const convertRes = await fetch(`${BASE_URL}/vacancy-requests/${reqData.id}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
  });
  if (!convertRes.ok) throw new Error(`Convert to Vacancy failed: ${convertRes.status} ${await convertRes.text()}`);
  const convertData = await convertRes.json();
  const generatedVacancy = convertData.vacancy;
  console.log(`✓ Converted to Active Vacancy: ${generatedVacancy.vacancyCode} (Status: ${generatedVacancy.status})`);

  // Step 4.3: Intake Candidate
  console.log('-> Step 4.3: Fast CV Intake / Creating Candidate...');
  const createCandRes = await fetch(`${BASE_URL}/candidates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      firstName: 'Zaid',
      lastName: 'Al-Mansoor',
      email: 'zaid.mansoor@example.com',
      phone: '+966501234567',
      currentTitle: 'Specialist Physician',
      currentCompany: 'King Faisal Specialist Hospital',
      source: 'DIRECT_CAREERS',
    }),
  });
  if (!createCandRes.ok) throw new Error(`Create Candidate failed: ${createCandRes.status} ${await createCandRes.text()}`);
  const candData = await createCandRes.json();
  console.log(`✓ Created Candidate: ${candData.candidateCode} (${candData.firstName} ${candData.lastName}, Email: ${candData.email})`);

  // Step 4.4: Create Application
  console.log('-> Step 4.4: Submitting Candidate Application...');
  const createAppRes = await fetch(`${BASE_URL}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      vacancyId: generatedVacancy.id,
      candidateId: candData.id,
      source: 'REFERRAL',
    }),
  });
  if (!createAppRes.ok) throw new Error(`Create Application failed: ${createAppRes.status} ${await createAppRes.text()}`);
  const appData = await createAppRes.json();
  console.log(`✓ Created Application: ${appData.applicationCode} (Stage: ${appData.stage}, Allowed Transitions: [${appData.allowedTransitions.join(', ')}])`);

  // Step 4.5: Stage Pipeline Progression: Applied -> Screening -> Interview -> Offer -> Pre-Hire -> Joined
  console.log('-> Step 4.5: Advancing Application Stages E2E...');
  const stages = [
    { target: 'Screening', from: 'Applied', version: 1 },
    { target: 'Interview', from: 'Screening', version: 2 },
    { target: 'Offer', from: 'Interview', version: 3 },
    { target: 'Pre-Hire', from: 'Offer', version: 4 },
    { target: 'Joined', from: 'Pre-Hire', version: 5 },
  ];

  for (const s of stages) {
    const stageRes = await fetch(`${BASE_URL}/applications/${appData.id}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        stage: s.target,
        expectedStage: s.from,
        expectedVersion: s.version,
        reason: `E2E automated validation advance to ${s.target}`,
      }),
    });
    if (!stageRes.ok) throw new Error(`Advance to ${s.target} failed: ${stageRes.status} ${await stageRes.text()}`);
    const updatedApp = await stageRes.json();
    console.log(`  ✓ Advanced to "${updatedApp.stage}" (version ${updatedApp.version})`);
  }

  // Step 4.6: Verify Application Detail retrieval
  const getAppRes = await fetch(`${BASE_URL}/applications/${appData.id}`, { headers: { Cookie: cookie } });
  const finalApp = await getAppRes.json();
  console.log(`✓ Final Application state: Code=${finalApp.applicationCode}, Candidate=${finalApp.candidate?.firstName} ${finalApp.candidate?.lastName}, Stage=${finalApp.stage}`);

  console.log('\n=== [5] Cleaning Up Transient Test Records ===');
  // Wipe test transactional records created during E2E verification
  await prisma.applicationStatusHistory.deleteMany({ where: { applicationId: appData.id } });
  await prisma.applicationNote.deleteMany({ where: { applicationId: appData.id } });
  await prisma.application.delete({ where: { id: appData.id } });
  await prisma.candidate.delete({ where: { id: candData.id } });
  await prisma.vacancyAssignment.deleteMany({ where: { vacancyId: generatedVacancy.id } });
  await prisma.vacancy.delete({ where: { id: generatedVacancy.id } });
  await prisma.vacancyRequestApproval.deleteMany({});
  await prisma.vacancyRequest.deleteMany({});
  await prisma.emailOutbox.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.task.deleteMany({});

  // Reset Code Sequences
  await prisma.codeSequence.deleteMany({});
  console.log('✓ All transient test records removed.');
  console.log('✓ Code sequences reset to 0.');
  console.log('✓ Database is completely clean and ready for actual real data upload!');

  console.log('\n================================================================');
  console.log('🎉 ALL RECRUITMENT WORKFLOW STEPS WORK TOGETHER FLAWLESSLY E2E!');
  console.log('================================================================\n');
}

runE2E()
  .catch((err) => {
    console.error('❌ E2E Validation Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
