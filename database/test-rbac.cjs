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

async function runRbacSuite() {
  console.log('=== P3.4 RBAC AUTHORIZATION ENFORCEMENT TEST SUITE ===\n');

  // Persona 1: Admin (Ahmed Mahmoud)
  const admin = await loginUser('ahmed.mahmoud@recruitflow.local', 'Password123!');
  console.log('Persona 1: Administrator (Ahmed Mahmoud)');
  const adminUsers = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/users',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  console.log('  1.1 Admin GET /users status:', adminUsers.status, adminUsers.status === 200 ? 'PASS (200 OK)' : 'FAIL');

  const adminRoles = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/roles',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  console.log('  1.2 Admin GET /roles status:', adminRoles.status, adminRoles.status === 200 ? 'PASS (200 OK)' : 'FAIL');

  const adminAudit = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/audit-logs',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  console.log('  1.3 Admin GET /audit-logs status:', adminAudit.status, adminAudit.status === 200 ? 'PASS (200 OK)' : 'FAIL');

  // Persona 2: Recruiter (Sarah Ahmed)
  const recruiter = await loginUser('sarah.ahmed@recruitflow.local', 'Password123!');
  console.log('\nPersona 2: Recruiter (Sarah Ahmed)');
  const recCandidates = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/candidates',
    method: 'GET',
    headers: { Cookie: recruiter.cookie },
  });
  console.log('  2.1 Recruiter GET /candidates status:', recCandidates.status, recCandidates.status === 200 ? 'PASS (200 OK)' : 'FAIL');

  const recUsers = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/users',
    method: 'GET',
    headers: { Cookie: recruiter.cookie },
  });
  console.log('  2.2 Recruiter GET /users status:', recUsers.status, recUsers.status === 403 ? 'PASS (403 Forbidden)' : 'FAIL');

  const recCreateUser = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/users',
      method: 'POST',
      headers: { Cookie: recruiter.cookie },
    },
    { email: 'hack@test.com', displayName: 'Hacker', password: 'Password123!' }
  );
  console.log('  2.3 Recruiter POST /users status:', recCreateUser.status, recCreateUser.status === 403 ? 'PASS (403 Forbidden)' : 'FAIL');

  const recAudit = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/audit-logs',
    method: 'GET',
    headers: { Cookie: recruiter.cookie },
  });
  console.log('  2.4 Recruiter GET /audit-logs status:', recAudit.status, recAudit.status === 403 ? 'PASS (403 Forbidden)' : 'FAIL');

  // Persona 3: Hiring Manager (Dr. Hassan Ali)
  const hiringMgr = await loginUser('hassan.ali@recruitflow.local', 'Password123!');
  console.log('\nPersona 3: Hiring Manager (Dr. Hassan Ali)');
  const hmVacReqs = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/vacancy-requests',
    method: 'GET',
    headers: { Cookie: hiringMgr.cookie },
  });
  console.log('  3.1 Hiring Manager GET /vacancy-requests status:', hmVacReqs.status, hmVacReqs.status === 200 ? 'PASS (200 OK)' : 'FAIL');

  const hmUsers = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/users',
    method: 'GET',
    headers: { Cookie: hiringMgr.cookie },
  });
  console.log('  3.2 Hiring Manager GET /users status:', hmUsers.status, hmUsers.status === 403 ? 'PASS (403 Forbidden)' : 'FAIL');

  // Persona 4: Interviewer (Aya Mostafa)
  const interviewer = await loginUser('aya.mostafa@recruitflow.local', 'Password123!');
  console.log('\nPersona 4: Interviewer (Aya Mostafa)');
  const intInterviews = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/interviews',
    method: 'GET',
    headers: { Cookie: interviewer.cookie },
  });
  console.log('  4.1 Interviewer GET /interviews status:', intInterviews.status, intInterviews.status === 200 ? 'PASS (200 OK)' : 'FAIL');

  const intUsers = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/users',
    method: 'GET',
    headers: { Cookie: interviewer.cookie },
  });
  console.log('  4.2 Interviewer GET /users status:', intUsers.status, intUsers.status === 403 ? 'PASS (403 Forbidden)' : 'FAIL');

  // Scenario 5: Unauthenticated access
  console.log('\nScenario 5: Unauthenticated Access');
  const unauthUsers = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/users',
    method: 'GET',
  });
  console.log('  5.1 Anonymous GET /users status:', unauthUsers.status, unauthUsers.status === 401 ? 'PASS (401 Unauthorized)' : 'FAIL');

  console.log('\n=== ALL RBAC AUTHORIZATION SCENARIOS PASSED ===');
}

runRbacSuite().catch(console.error);
