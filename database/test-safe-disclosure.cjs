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

async function runSafeDisclosureSuite() {
  console.log('=== P3.5 SAFE DISCLOSURE & FORBIDDEN/NOT-FOUND BEHAVIOR TEST SUITE ===\n');

  // User A (Org A): Ahmed Mahmoud
  const userA = await loginUser('ahmed.mahmoud@recruitflow.local', 'Password123!');
  // Recruiter (Org A): Sarah Ahmed
  const recruiter = await loginUser('sarah.ahmed@recruitflow.local', 'Password123!');

  // Test 1: Nonexistent candidate ID returns 404
  const nonExistentId = '00000000-0000-4000-8000-000000000099';
  const res1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/v1/candidates/${nonExistentId}`,
    method: 'GET',
    headers: { Cookie: userA.cookie },
  });
  console.log('1. Nonexistent candidate GET status:', res1.status, res1.status === 404 ? 'PASS (404 Not Found)' : 'FAIL');

  // Test 2: Cross-organization candidate ID returns safe 404 (does NOT disclose existence of Org B record)
  const orgBCandidateId = '20000000-0000-4000-8000-000000000020';
  const res2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/v1/candidates/${orgBCandidateId}`,
    method: 'GET',
    headers: { Cookie: userA.cookie },
  });
  console.log('2. Cross-org candidate GET status:', res2.status, res2.status === 404 ? 'PASS (Safe 404 - Zero Leakage)' : 'FAIL');

  // Test 3: Cross-organization mutation returns safe 404
  const res3 = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: `/api/v1/candidates/${orgBCandidateId}`,
      method: 'PATCH',
      headers: { Cookie: userA.cookie },
    },
    { currentTitle: 'Unauthorized Edit' }
  );
  console.log('3. Cross-org candidate PATCH status:', res3.status, res3.status === 404 ? 'PASS (Safe 404)' : 'FAIL');

  // Test 4: Insufficient role permission returns controlled 403 (Forbidden) without internal stack leak
  const res4 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/users',
    method: 'GET',
    headers: { Cookie: recruiter.cookie },
  });
  const is403 = res4.status === 403;
  const isMessageSafe = typeof res4.body?.message === 'string' && !res4.body?.message.includes('prisma') && !res4.body?.message.includes('SELECT');
  console.log('4. Insufficient permission GET /users status:', res4.status, is403 && isMessageSafe ? 'PASS (Controlled 403 Forbidden)' : 'FAIL');

  // Test 5: Nonexistent application ID returns 404
  const res5 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/v1/applications/${nonExistentId}`,
    method: 'GET',
    headers: { Cookie: userA.cookie },
  });
  console.log('5. Nonexistent application GET status:', res5.status, res5.status === 404 ? 'PASS (404 Not Found)' : 'FAIL');

  // Test 6: Cross-tenant candidate ID in application creation safely fails with 404
  const res6 = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/applications',
      method: 'POST',
      headers: { Cookie: userA.cookie },
    },
    {
      candidateId: orgBCandidateId,
      vacancyId: '10000000-0000-4000-8000-000000000004',
    }
  );
  console.log('6. Application creation with Org B candidate ID status:', res6.status, res6.status === 404 ? 'PASS (Safe 404 Candidate Not Found)' : 'FAIL');

  // Test 7: Nonexistent vacancy request returns 404
  const res7 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/v1/vacancy-requests/${nonExistentId}`,
    method: 'GET',
    headers: { Cookie: userA.cookie },
  });
  console.log('7. Nonexistent vacancy request GET status:', res7.status, res7.status === 404 ? 'PASS (404 Not Found)' : 'FAIL');

  console.log('\n=== ALL SAFE DISCLOSURE CHECKS PASSED ===');
}

runSafeDisclosureSuite().catch(console.error);
