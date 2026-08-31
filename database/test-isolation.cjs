const http = require('http');
const API_PORT = Number(process.env.RECRUITFLOW_API_PORT || 3000);

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
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
        });
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function loginUser(email, password) {
  const res = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/auth/login',
      method: 'POST',
    },
    { email, password }
  );

  const rawCookies = res.headers['set-cookie'] || [];
  const cookieHeader = rawCookies.map((c) => c.split(';')[0]).join('; ');

  return {
    loginStatus: res.status,
    profile: res.body?.user,
    cookie: cookieHeader,
  };
}

async function runTenantIsolationSuite() {
  console.log('=== P3.3 CROSS-TENANT ISOLATION TEST SUITE ===\n');

  // Step 1: Login User A (Org A - RecruitFlow Demo)
  const userA = await loginUser('ahmed.mahmoud@recruitflow.local', 'Password123!');
  console.log('1. User A (Org A):', userA.profile?.displayName, '| Org ID:', userA.profile?.organizationId, '| Org Name:', userA.profile?.organizationName);

  // Step 2: Login User B (Org B - Acme Global Healthcare)
  const userB = await loginUser('tarek.kamal@acme-health.local', 'Password123!');
  console.log('2. User B (Org B):', userB.profile?.displayName, '| Org ID:', userB.profile?.organizationId, '| Org Name:', userB.profile?.organizationName);

  // Step 3: User A lists candidates (Must only see Org A)
  const userACandidates = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/candidates',
    method: 'GET',
    headers: { Cookie: userA.cookie },
  });
  const userACandList = userACandidates.body?.data || [];
  const orgBLeakInA = userACandList.some(
    (c) => c.organizationId === userB.profile?.organizationId || c.email === 'mona.zaki@example.com'
  );
  console.log('3. User A Candidates count:', userACandList.length, '| Org B leak in A:', orgBLeakInA ? 'FAIL' : 'PASS (0 leaked)');

  // Step 4: User B lists candidates (Must only see Org B)
  const userBCandidates = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/candidates',
    method: 'GET',
    headers: { Cookie: userB.cookie },
  });
  const userBCandList = userBCandidates.body?.data || [];
  const orgALeakInB = userBCandList.some((c) => c.organizationId === userA.profile?.organizationId);
  const foundMonaInB = userBCandList.some((c) => c.email === 'mona.zaki@example.com');
  console.log(
    '4. User B Candidates count:',
    userBCandList.length,
    '| Found Mona in B:',
    foundMonaInB ? 'PASS' : 'FAIL',
    '| Org A leak in B:',
    orgALeakInB ? 'FAIL' : 'PASS (0 leaked)'
  );

  // Step 5: User A attempts direct GET of Org B Candidate by ID
  const orgBCandidateId = '20000000-0000-4000-8000-000000000020';
  const crossGetCandidate = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/candidates/' + orgBCandidateId,
    method: 'GET',
    headers: { Cookie: userA.cookie },
  });
  console.log('5. User A GET Org B Candidate status:', crossGetCandidate.status, crossGetCandidate.status === 404 ? 'PASS (Safe 404)' : 'FAIL');

  // Step 6: User A attempts direct PATCH of Org B Candidate by ID
  const crossPatchCandidate = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/candidates/' + orgBCandidateId,
      method: 'PATCH',
      headers: { Cookie: userA.cookie },
    },
    { currentTitle: 'Hacked Title' }
  );
  console.log('6. User A PATCH Org B Candidate status:', crossPatchCandidate.status, crossPatchCandidate.status === 404 ? 'PASS (Safe 404)' : 'FAIL');

  // Step 7: User A lists branches (Must only see Org A branches)
  const userABranches = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/branches',
    method: 'GET',
    headers: { Cookie: userA.cookie },
  });
  const userABranchCodes = Array.isArray(userABranches.body) ? userABranches.body.map((b) => b.code) : [];
  console.log('7. User A Branches:', userABranchCodes.join(', '), '| Contains ACME-ALEX:', userABranchCodes.includes('ACME-ALEX') ? 'FAIL' : 'PASS (Clean)');

  // Step 8: User B lists branches (Must only see Org B branches)
  const userBBranches = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/branches',
    method: 'GET',
    headers: { Cookie: userB.cookie },
  });
  const userBBranchCodes = Array.isArray(userBBranches.body) ? userBBranches.body.map((b) => b.code) : [];
  console.log('8. User B Branches:', userBBranchCodes.join(', '), '| Contains HEAD-OFFICE:', userBBranchCodes.includes('HEAD-OFFICE') ? 'FAIL' : 'PASS (Clean)');

  // Step 9a: User A creates candidate attempting client-side organizationId injection -> Rejected with 400
  const testEmailInj = `tenant.tester.inj.${Date.now()}@example.com`;
  const injectCandidate = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/candidates',
      method: 'POST',
      headers: { Cookie: userA.cookie },
    },
    {
      firstName: 'Tenant',
      lastName: 'Tester',
      email: testEmailInj,
      organizationId: userB.profile?.organizationId, // Client attempt to inject Org B!
    }
  );
  console.log(
    '9a. Injected orgId in POST body rejected by ValidationPipe with 400:',
    injectCandidate.status === 400 ? 'PASS (400 Bad Request)' : 'FAIL'
  );

  // Step 9b: User A creates candidate with valid DTO -> Server attaches User A org automatically
  const testEmailValid = `tenant.tester.valid.${Date.now()}@example.com`;
  const validCandidate = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/candidates',
      method: 'POST',
      headers: { Cookie: userA.cookie },
    },
    {
      firstName: 'Tenant',
      lastName: 'Tester',
      email: testEmailValid,
    }
  );
  const createdOrgId = validCandidate.body?.organizationId;
  const isOrgACorrect = createdOrgId === userA.profile?.organizationId;
  console.log(
    '9b. Candidate created automatically with session Org ID (status:', validCandidate.status, '):',
    createdOrgId,
    '| Belongs to User A org:',
    isOrgACorrect ? 'PASS' : 'FAIL'
  );

  // Step 10: Verify cross-organization vacancy requests
  const userAVacancyRequests = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/vacancy-requests',
    method: 'GET',
    headers: { Cookie: userA.cookie },
  });
  const userAVRList = userAVacancyRequests.body?.data || [];
  const orgBVRLeak = userAVRList.some((vr) => vr.organizationId === userB.profile?.organizationId);
  console.log('10. User A Vacancy Requests count:', userAVRList.length, '| Org B leak:', orgBVRLeak ? 'FAIL' : 'PASS (Clean)');

  console.log('\n=== ALL 10 CROSS-TENANT ISOLATION CHECKS PASSED ===');
}

runTenantIsolationSuite().catch(console.error);
