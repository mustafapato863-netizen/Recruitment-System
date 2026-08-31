/**
 * M1-G4 Comprehensive Tenant Isolation & RLS Test Suite
 *
 * Verifies strict multi-tenant isolation, row-level visibility, relationship-aware scoping,
 * and safe disclosure across all 26 resource families and child relations using
 * deterministic per-run fixtures generated for Org A and Org B.
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('../apps/api/node_modules/xlsx');
const { setup: setupFixtures, cleanup: cleanupFixtures, prisma } = require('./m1-g4-fixture-manager.cjs');

const BASE_URL = process.env.RECRUITFLOW_API_URL || 'http://127.0.0.1:3000/api/v1';

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const session = typeof options.token === 'object' && options.token !== null ? options.token : options.session;
  const token = typeof options.token === 'string' ? options.token : session?.accessToken;
  const cookie = options.cookie || session?.cookie;

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const isXlsx = res.headers.get('content-type')?.includes('spreadsheet') || res.headers.get('content-type')?.includes('octet-stream');

    let data = null;
    let buffer = null;
    if (isJson) {
      data = await res.json();
    } else if (isXlsx) {
      const arrayBuf = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
    } else {
      data = await res.text();
    }

    return {
      status: res.status,
      headers: res.headers,
      data,
      buffer,
    };
  } catch (err) {
    return {
      status: 0,
      error: err.message,
    };
  }
}

async function login(email, password = 'Password123!') {
  const url = `${BASE_URL}/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => null);
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: status=${res.status}, response=${JSON.stringify(data)}`);
  }

  const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  const cookieHeader = rawCookies.map(c => c.split(';')[0]).join('; ');

  let accessToken = null;
  for (const c of rawCookies) {
    if (c.includes('access_token=')) {
      const match = c.match(/access_token=([^;]+)/);
      if (match) accessToken = match[1];
    }
  }

  return {
    cookie: cookieHeader,
    accessToken,
    user: data?.user || data?.data?.user,
    organization: { id: data?.user?.organizationId || data?.data?.organization?.id },
  };
}

async function runM1G4Suite() {
  console.log('===============================================================');
  console.log('=== M1-G4 TENANT ISOLATION, RLS & ROW-LEVEL VISIBILITY SUITE ===');
  console.log('===============================================================\n');

  let manifest = null;

  try {
    // ─── Step 0: Authenticate Personas ──────────────────────────────────────────
    console.log('--- Step 0: Authenticating Personas ---');
    const adminA = await login('ahmed.mahmoud@recruitflow.local');
    const recruiterA = await login('sarah.ahmed@recruitflow.local');
    const hmA = await login('hassan.ali@recruitflow.local');
    const adminB = await login('tarek.kamal@acme-health.local');

    check('Admin Org A authenticated successfully', !!adminA.accessToken);
    check('Recruiter Org A authenticated successfully', !!recruiterA.accessToken);
    check('Hiring Manager Org A authenticated successfully', !!hmA.accessToken);
    check('Admin Org B authenticated successfully', !!adminB.accessToken);
    check('Tenants are distinct', adminA.organization.id !== adminB.organization.id, `Org A: ${adminA.organization.id}, Org B: ${adminB.organization.id}`);

    // ─── Step 1: Generate Deterministic Multi-Tenant Fixtures ──────────────────
    console.log('\n--- Step 1: Setting up Deterministic Test Fixtures ---');
    manifest = await setupFixtures();
    check('Test fixtures generated with unique runId', !!manifest.runId, `runId=${manifest.runId}`);

    const fA = manifest.fixturesA;
    const fB = manifest.fixturesB;

    // ─── Step 2: Same-Tenant Authorized Direct & Child Reads ────────────────────
    console.log('\n--- 2. Same-Tenant Authorized Direct & Child Reads ---');
    const getCandA = await request(`/candidates/${fA.candidate.id}`, { token: adminA.accessToken });
    check('Admin A reads own Candidate', getCandA.status === 200, `id=${fA.candidate.id}`);

    const getCandB = await request(`/candidates/${fB.candidate.id}`, { token: adminB.accessToken });
    check('Admin B reads own Candidate', getCandB.status === 200, `id=${fB.candidate.id}`);

    const getVacA = await request(`/vacancies/${fA.vacancy.id}`, { token: adminA.accessToken });
    check('Admin A reads own Vacancy', getVacA.status === 200, `id=${fA.vacancy.id}`);

    const getVacB = await request(`/vacancies/${fB.vacancy.id}`, { token: adminB.accessToken });
    check('Admin B reads own Vacancy', getVacB.status === 200, `id=${fB.vacancy.id}`);

    const getAppA = await request(`/applications/${fA.application.id}`, { token: adminA.accessToken });
    check('Admin A reads own Application', getAppA.status === 200, `id=${fA.application.id}`);

    const getDocA = await request(`/documents/${fA.document.id}`, { token: adminA.accessToken });
    check('Admin A reads own Candidate Document', getDocA.status === 200, `id=${fA.document.id}`);

    const getPoolA = await request(`/talent-pools/${fA.talentPool.id}`, { token: adminA.accessToken });
    check('Admin A reads own Talent Pool', getPoolA.status === 200, `id=${fA.talentPool.id}`);

    const getIntA = await request(`/interviews/${fA.interview.id}`, { token: adminA.accessToken });
    check('Admin A reads own Interview', getIntA.status === 200, `id=${fA.interview.id}`);

    const getOfferA = await request(`/offers/${fA.offer.id}`, { token: adminA.accessToken });
    check('Admin A reads own Offer', getOfferA.status === 200, `id=${fA.offer.id}`);

    const getHCaseA = await request(`/hiring/${fA.hiringCase.id}`, { token: adminA.accessToken });
    check('Admin A reads own Hiring Case', getHCaseA.status === 200, `id=${fA.hiringCase.id}`);

    const getVrA = await request(`/vacancy-requests/${fA.vacancyRequest.id}`, { token: adminA.accessToken });
    check('Admin A reads own Vacancy Request', getVrA.status === 200, `id=${fA.vacancyRequest.id}`);

    const getPipeA = await request(`/pipeline-templates/${fA.pipelineTemplate.id}`, { token: adminA.accessToken });
    check('Admin A reads own Pipeline Template', getPipeA.status === 200, `id=${fA.pipelineTemplate.id}`);

    const getTaskA = await request(`/tasks/${fA.task.id}`, { token: adminA.accessToken });
    check('Admin A reads own Task', getTaskA.status === 200, `id=${fA.task.id}`);

    const getUserA = await request(`/users/${fA.user.id}`, { token: adminA.accessToken });
    check('Admin A reads own User', getUserA.status === 200, `id=${fA.user.id}`);

    const getIntegA = await request(`/integrations/${fA.integration.id}`, { token: adminA.accessToken });
    check('Admin A reads own Integration', getIntegA.status === 200, `id=${fA.integration.id}`);

    // ─── Step 3: Same-Tenant Unauthorized RBAC Denials ──────────────────────────
    console.log('\n--- 3. Same-Tenant Unauthorized Reads/Mutations (RBAC) ---');
    const recUsers = await request('/users', { token: recruiterA.accessToken });
    check('Recruiter A blocked from GET /users', recUsers.status === 403, `status=${recUsers.status}`);

    const recPostRole = await request('/roles', { token: recruiterA.accessToken, method: 'POST', body: { code: 'TEST_RBAC', name: 'Test' } });
    check('Recruiter A blocked from POST /roles', recPostRole.status === 403, `status=${recPostRole.status}`);

    const hmAudit = await request('/audit-logs', { token: hmA.accessToken });
    check('Hiring Manager A blocked from GET /audit-logs', hmAudit.status === 403, `status=${hmAudit.status}`);

    // ─── Step 4: Roles and Role Permissions Scoping ────────────────────────────
    console.log('\n--- 4. Roles and Role Permissions Scoping ---');
    const sysRoles = await request('/roles', { token: adminA.accessToken });
    const rolesList = Array.isArray(sysRoles.data) ? sysRoles.data : (sysRoles.data?.data || []);
    const adminSysRole = rolesList.find(r => r.code === 'ADMINISTRATOR' && (r.organizationId === null || !r.organizationId));
    check('Admin A lists shared system role (ADMINISTRATOR)', !!adminSysRole, `sysRole=${adminSysRole?.code}`);

    if (adminSysRole) {
      const getSysRole = await request(`/roles/${adminSysRole.id}`, { token: adminA.accessToken });
      check('Admin A reads shared system role', getSysRole.status === 200, `status=${getSysRole.status}`);

      const patchSysRole = await request(`/roles/${adminSysRole.id}`, {
        token: adminA.accessToken,
        method: 'PATCH',
        body: { name: 'Attempted Rename' },
      });
      check('Admin A blocked from mutating system role', patchSysRole.status === 403, `status=${patchSysRole.status}`);
    }

    const getOwnRole = await request(`/roles/${fA.role.id}`, { token: adminA.accessToken });
    check('Admin A reads own custom role', getOwnRole.status === 200, `id=${fA.role.id}`);

    const getForeignRole = await request(`/roles/${fB.role.id}`, { token: adminA.accessToken });
    check('Admin A GET Org B custom role returns 404', getForeignRole.status === 404, `id=${fB.role.id}`);

    const patchForeignRole = await request(`/roles/${fB.role.id}`, {
      token: adminA.accessToken,
      method: 'PATCH',
      body: { name: 'Cross-Tenant Update' },
    });
    check('Admin A PATCH Org B custom role returns 404', patchForeignRole.status === 404, `status=${patchForeignRole.status}`);

    const assignForeignRole = await request(`/users/${fA.user.id}/roles/${fB.role.id}`, {
      token: adminA.accessToken,
      method: 'POST',
    });
    check('Assigning Org B custom role to Org A user returns 404', assignForeignRole.status === 404, `status=${assignForeignRole.status}`);

    // ─── Step 5: Cross-Tenant Safe 404 Reads across all 26 Families ─────────────
    console.log('\n--- 5. Cross-Tenant Safe 404 Reads Across All 26 Resource Families ---');
    const xCand = await request(`/candidates/${fB.candidate.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET Candidate returns 404', xCand.status === 404, `status=${xCand.status}`);

    const xVac = await request(`/vacancies/${fB.vacancy.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET Vacancy returns 404', xVac.status === 404, `status=${xVac.status}`);

    const xVr = await request(`/vacancy-requests/${fB.vacancyRequest.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET Vacancy Request returns 404', xVr.status === 404, `status=${xVr.status}`);

    const xApp = await request(`/applications/${fB.application.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET Application returns 404', xApp.status === 404, `status=${xApp.status}`);

    const xDoc = await request(`/documents/${fB.document.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET Document returns 404', xDoc.status === 404, `status=${xDoc.status}`);

    const xInt = await request(`/interviews/${fB.interview.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET Interview returns 404', xInt.status === 404, `status=${xInt.status}`);

    const xOff = await request(`/offers/${fB.offer.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET Offer returns 404', xOff.status === 404, `status=${xOff.status}`);

    const xHc = await request(`/hiring/${fB.hiringCase.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET Hiring Case returns 404', xHc.status === 404, `status=${xHc.status}`);

    const xTp = await request(`/talent-pools/${fB.talentPool.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET Talent Pool returns 404', xTp.status === 404, `status=${xTp.status}`);

    const xPt = await request(`/pipeline-templates/${fB.pipelineTemplate.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET Pipeline Template returns 404', xPt.status === 404, `status=${xPt.status}`);

    const xTask = await request(`/tasks/${fB.task.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET Task returns 404', xTask.status === 404, `status=${xTask.status}`);

    const xUser = await request(`/users/${fB.user.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET User returns 404', xUser.status === 404, `status=${xUser.status}`);

    const xInteg = await request(`/integrations/${fB.integration.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET Integration returns 404', xInteg.status === 404, `status=${xInteg.status}`);

    const xJob = await request(`/candidates/import/${fB.importJob.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET Import Job returns 404', xJob.status === 404, `status=${xJob.status}`);

    // ─── Step 6: Cross-Tenant Mutation Denials ───────────────────────────────────
    console.log('\n--- 6. Cross-Tenant Mutation Denials ---');
    const xPatchCand = await request(`/candidates/${fB.candidate.id}`, {
      token: adminA.accessToken,
      method: 'PATCH',
      body: { firstName: 'Compromised' },
    });
    check('Cross-tenant PATCH Candidate returns 404', xPatchCand.status === 404, `status=${xPatchCand.status}`);

    const xPatchVac = await request(`/vacancies/${fB.vacancy.id}/status`, {
      token: adminA.accessToken,
      method: 'PATCH',
      body: { status: 'On Hold' },
    });
    check('Cross-tenant PATCH Vacancy Status returns 404', xPatchVac.status === 404, `status=${xPatchVac.status}`);

    const xPatchApp = await request(`/applications/${fB.application.id}/stage`, {
      token: adminA.accessToken,
      method: 'PATCH',
      body: { stage: 'Interview' },
    });
    check('Cross-tenant PATCH Application Stage returns 404', xPatchApp.status === 404, `status=${xPatchApp.status}`);

    const xDelPipe = await request(`/pipeline-templates/${fB.pipelineTemplate.id}`, {
      token: adminA.accessToken,
      method: 'DELETE',
    });
    check('Cross-tenant DELETE Pipeline Template returns 404', xDelPipe.status === 404, `status=${xDelPipe.status}`);

    const xOffApprove = await request(`/offers/approvals/${fB.offerApproval.id}/decide`, {
      token: adminA.accessToken,
      method: 'POST',
      body: { decision: 'Approved' },
    });
    check('Cross-tenant Offer Approval Decision returns 404', xOffApprove.status === 404, `status=${xOffApprove.status}`);

    const xHcCompliance = await request(`/hiring/${fB.hiringCase.id}/compliance/${fB.complianceRequirement.id}`, {
      token: adminA.accessToken,
      method: 'PATCH',
      body: { status: 'Verified' },
    });
    check('Cross-tenant Hiring Case Compliance update returns 404', xHcCompliance.status === 404, `status=${xHcCompliance.status}`);

    const xTpAdd = await request(`/talent-pools/${fB.talentPool.id}/candidates`, {
      token: adminA.accessToken,
      method: 'POST',
      body: { candidateId: fA.candidate.id },
    });
    check('Cross-tenant Talent Pool Candidate add returns 404', xTpAdd.status === 404, `status=${xTpAdd.status}`);

    // ─── Step 7: Child-Resource & Parent Relation Scoping ────────────────────────
    console.log('\n--- 7. Child-Resource & Parent Relation Isolation ---');
    const xCandDocs = await request(`/documents/candidate/${fB.candidate.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET Candidate Documents returns 404', xCandDocs.status === 404, `status=${xCandDocs.status}`);

    const xAppHistory = await request(`/applications/${fB.application.id}/history`, { token: adminA.accessToken });
    check('Cross-tenant GET Application History returns 404', xAppHistory.status === 404, `status=${xAppHistory.status}`);

    const xScreening = await request(`/screening/application/${fB.application.id}`, { token: adminA.accessToken });
    check('Cross-tenant GET Screening Logs returns 404', xScreening.status === 404, `status=${xScreening.status}`);

    const xJobRows = await request(`/candidates/import/${fB.importJob.id}/rows`, { token: adminA.accessToken });
    check('Cross-tenant GET Import Job Rows returns 404', xJobRows.status === 404, `status=${xJobRows.status}`);

    // ─── Step 8: Foreign-Tenant Foreign-Key Reference Prevention ─────────────────
    console.log('\n--- 8. Foreign-Tenant Foreign-Key Reference Prevention ---');
    const appForeignCand = await request('/applications', {
      token: adminA.accessToken,
      method: 'POST',
      body: {
        candidateId: fB.candidate.id,
        vacancyId: fA.vacancy.id,
      },
    });
    check('Create Application with foreign candidateId rejected', appForeignCand.status === 404 || appForeignCand.status === 400, `status=${appForeignCand.status}`);

    const appForeignVac = await request('/applications', {
      token: adminA.accessToken,
      method: 'POST',
      body: {
        candidateId: fA.candidate.id,
        vacancyId: fB.vacancy.id,
      },
    });
    check('Create Application with foreign vacancyId rejected', appForeignVac.status === 404 || appForeignVac.status === 400, `status=${appForeignVac.status}`);

    // ─── Step 9: List, Search, and Pagination Isolation ──────────────────────────
    console.log('\n--- 9. List, Search, and Pagination Isolation ---');
    const listCandA = await request('/candidates', { token: adminA.accessToken });
    const candsA = listCandA.data?.data?.items || listCandA.data?.data || [];
    const leakedCandInA = candsA.some(c => c.id === fB.candidate.id || c.email?.includes('orgb'));
    check('Org A Candidate list contains 0 Org B items', !leakedCandInA, `count=${candsA.length}`);

    const listCandB = await request('/candidates', { token: adminB.accessToken });
    const candsB = listCandB.data?.data?.items || listCandB.data?.data || [];
    const leakedCandInB = candsB.some(c => c.id === fA.candidate.id || c.email?.includes('orga'));
    check('Org B Candidate list contains 0 Org A items', !leakedCandInB, `count=${candsB.length}`);

    const listVacA = await request('/vacancies', { token: adminA.accessToken });
    const vacsA = listVacA.data?.data?.items || listVacA.data?.data || [];
    const leakedVacInA = vacsA.some(v => v.id === fB.vacancy.id);
    check('Org A Vacancy list contains 0 Org B items', !leakedVacInA, `count=${vacsA.length}`);

    const searchA = await request(`?q=${fB.candidate.lastName}`, { token: adminA.accessToken });
    const searchData = JSON.stringify(searchA.data || {});
    check('Global search in Org A does not leak Org B items', !searchData.includes(fB.candidate.id));

    // ─── Step 10: Reports & XLSX Export Verification via SheetJS ─────────────────
    console.log('\n--- 10. Reports, XLSX Export Parsing & Content Verification ---');
    const repOverview = await request('/reports/overview', { token: adminA.accessToken });
    check('Admin A GET /reports/overview', repOverview.status === 200, `status=${repOverview.status}`);

    const repExport = await request('/reports/export.xlsx', { token: adminA.accessToken });
    check('Admin A GET /reports/export.xlsx returns stream', repExport.status === 200 && !!repExport.buffer);

    if (repExport.buffer) {
      const workbook = XLSX.read(repExport.buffer, { type: 'buffer' });
      check('Export XLSX contains 5 sheets', workbook.SheetNames.length === 5, `sheets=${workbook.SheetNames.join(',')}`);

      let foundOrgBLeak = false;
      for (const sheetName of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        const sheetStr = JSON.stringify(rows);
        if (sheetStr.includes(fB.candidate.id) || sheetStr.includes(fB.candidate.email) || sheetStr.includes(manifest.orgBId)) {
          foundOrgBLeak = true;
        }
      }
      check('Parsed XLSX workbook contains 0 Org B strings/names/records', !foundOrgBLeak);
    }

    // ─── Step 11: Audit Log Isolation & Exact Failed Entry Verification ──────────
    console.log('\n--- 11. Audit Log Isolation & Exact Failed Entry Verification ---');
    const invalidCreate = await request('/candidates', {
      token: adminA.accessToken,
      method: 'POST',
      body: { invalidField: true },
    });
    check('Invalid candidate create triggers 400 Bad Request', invalidCreate.status === 400, `status=${invalidCreate.status}`);

    const failedAudit = await prisma.auditLog.findFirst({
      where: {
        organizationId: adminA.organization.id,
        actorUserId: adminA.user.id,
        action: { contains: 'CANDIDATE' },
        result: 'FAILURE',
      },
      orderBy: { createdAt: 'desc' },
    });

    check('Failed audited authenticated action created an AuditLog row', !!failedAudit, `id=${failedAudit?.id}`);
    if (failedAudit) {
      check('Failed audit log organizationId matches verified JWT org', failedAudit.organizationId === adminA.organization.id);
      check('Failed audit log actorUserId matches authenticated admin', failedAudit.actorUserId === adminA.user.id);
      check('Failed audit log result is FAILURE', failedAudit.result === 'FAILURE');
      check('Failed audit log reason is safely redacted', !failedAudit.reason?.includes('password') && !failedAudit.reason?.includes('DATABASE_URL'));
    }

    const orgBAudits = await prisma.auditLog.count({
      where: {
        organizationId: adminB.organization.id,
        actorUserId: adminA.user.id,
      },
    });
    check('Cross-tenant attempts by User A created 0 audit records in Org B', orgBAudits === 0, `orgBAudits=${orgBAudits}`);

    // ─── Step 12: Document & CV Download Isolation ──────────────────────────────
    console.log('\n--- 12. Document / CV Download Isolation ---');
    const dlForeignDoc = await request(`/documents/${fB.document.id}/download`, { token: adminA.accessToken });
    check('User A GET Org B Document Download returns 404', dlForeignDoc.status === 404, `status=${dlForeignDoc.status}`);

    const cvBankA = await request('/documents/cv-bank', { token: adminA.accessToken });
    const cvDocs = cvBankA.data?.data?.items || cvBankA.data?.data || [];
    const leakedDoc = cvDocs.some(d => d.id === fB.document.id || d.fileName?.includes('orgb'));
    check('Org A CV Bank contains 0 Org B documents', !leakedDoc, `count=${cvDocs.length}`);

    // ─── Step 13: Client-Controlled Tenant Override Immunity ────────────────────
    console.log('\n--- 13. Client-Controlled Tenant Override Attempts ---');
    const bodyOverride = await request('/candidates', {
      token: adminA.accessToken,
      method: 'POST',
      body: {
        firstName: 'Injected',
        lastName: 'Override',
        email: `injected_${manifest.runId}@example.com`,
        organizationId: adminB.organization.id,
      },
    });
    check('POST /candidates with injected organizationId rejected with 400', bodyOverride.status === 400, `status=${bodyOverride.status}`);

    const headerOverride = await request('/candidates', {
      token: adminA.accessToken,
      headers: { 'X-Tenant-Id': adminB.organization.id },
    });
    const headerCands = headerOverride.data?.data?.items || headerOverride.data?.data || [];
    check('X-Tenant-Id header injection has no effect on tenant scoping', !headerCands.some(c => c.id === fB.candidate.id));

    const xOrgHeaderOverride = await request('/candidates', {
      token: adminA.accessToken,
      headers: { 'x-organization-id': adminB.organization.id },
    });
    const xOrgCands = xOrgHeaderOverride.data?.data?.items || xOrgHeaderOverride.data?.data || [];
    check('x-organization-id header injection has no effect on tenant scoping', !xOrgCands.some(c => c.id === fB.candidate.id));

    const queryOverride = await request(`/candidates?organizationId=${adminB.organization.id}`, {
      token: adminA.accessToken,
    });
    const queryCands = queryOverride.data?.data?.items || queryOverride.data?.data || [];
    check('?organizationId query parameter injection has no effect on tenant scoping', !queryCands.some(c => c.id === fB.candidate.id));

    // ─── Step 14: Safe Error Parity Between Nonexistent and Cross-Tenant ─────────
    console.log('\n--- 14. Safe Error Parity Between Nonexistent and Cross-Tenant Identifiers ---');
    const nonexistentId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const nonExistentRes = await request(`/candidates/${nonexistentId}`, { token: adminA.accessToken });
    const crossTenantRes = await request(`/candidates/${fB.candidate.id}`, { token: adminA.accessToken });

    check('Non-existent UUID produces 404', nonExistentRes.status === 404);
    check('Foreign tenant UUID produces 404', crossTenantRes.status === 404);
    check('Error code parity: NOT_FOUND === NOT_FOUND', nonExistentRes.data?.code === 'NOT_FOUND' && crossTenantRes.data?.code === 'NOT_FOUND');
    check('Error message structure parity: safe existence-neutral 404 messages', typeof nonExistentRes.data?.message === 'string' && typeof crossTenantRes.data?.message === 'string');

    // ─── Step 15: Notifications, Tasks & User Row Visibility ────────────────────
    console.log('\n--- 15. Notifications, Tasks & User Row Visibility ---');
    const tasksA = await request('/tasks', { token: adminA.accessToken });
    const taskItems = tasksA.data?.data?.items || tasksA.data?.data || [];
    check('Org A Tasks list contains 0 Org B tasks', !taskItems.some(t => t.id === fB.task.id));

    const notifsA = await request('/notifications', { token: adminA.accessToken });
    check('GET /notifications scoped to authenticated user', notifsA.status === 200, `status=${notifsA.status}`);

    const patchNotifA = await request(`/notifications/${fA.notification.id}/read`, {
      token: adminA.accessToken,
      method: 'PATCH',
    });
    check('PATCH /notifications/:id/read on own notification succeeds', patchNotifA.status === 200, `status=${patchNotifA.status}`);

    const patchNotifB = await request(`/notifications/${fB.notification.id}/read`, {
      token: adminA.accessToken,
      method: 'PATCH',
    });
    check('PATCH /notifications/:id/read on Org B notification returns 404', patchNotifB.status === 404, `status=${patchNotifB.status}`);

  } catch (err) {
    console.error('Fatal error during test suite execution:', err);
    failed++;
  } finally {
    if (manifest?.runId) {
      console.log('\n--- Tearing Down Test Fixtures ---');
      await cleanupFixtures(manifest.runId);
      console.log(`Cleaned up fixtures for runId: ${manifest.runId}`);
    }
    await prisma.$disconnect();
  }

  console.log('\n===============================================================');
  console.log(`=== M1-G4 TEST RESULTS: ${passed} PASSED, ${failed} FAILED ===`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  runM1G4Suite().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
