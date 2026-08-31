/**
 * P3.6 — Authentication, Tenant, and RBAC Verification Test Matrix
 *
 * Covers:
 * - Unauthenticated requests return 401
 * - Valid authenticated users can access permitted routes
 * - Expired/invalid sessions rejected safely
 * - Users cannot access another organization's records
 * - Cross-tenant records return uniform 404
 * - Authenticated users without permissions receive controlled 403
 * - Responses never expose Prisma errors, SQL, table names, stack traces
 * - Invalid UUIDs, malformed payloads, missing required fields return safe errors
 * - Candidate, application, vacancy, interview, offer, vacancy-request routes covered
 */

const http = require('http');
const API_PORT = Number(process.env.RECRUITFLOW_API_PORT || 3000);

// ─── HTTP helper ────────────────────────────────────────────────
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

function isSafe(body, isErrorResponse = true) {
  if (!body) return true;
  // Only apply strict checks to error responses, not to legitimate data payloads
  if (!isErrorResponse) return true;
  const str = typeof body === 'string' ? body : JSON.stringify(body);
  // These patterns should NEVER appear in error responses
  const leaks = [
    'prisma',
    'SELECT ',
    'INSERT ',
    'DELETE ',
    'UPDATE ',
    'at async ',
    'node_modules',
    'dist/apps/api',
    'PrismaClientKnownRequestError',
  ];
  return !leaks.some(l => str.includes(l));
}

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${label}${detail ? ' — ' + detail : ''}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ─── Main test runner ────────────────────────────────────────────
async function runP36Suite() {
  console.log('=== P3.6 AUTHENTICATION, TENANT & RBAC VERIFICATION TEST MATRIX ===\n');

  // ─── Login all test personas ──────────────────────────────────
  const ahmed = await login('ahmed.mahmoud@recruitflow.local', 'Password123!'); // Admin/HR Manager
  const sarah = await login('sarah.ahmed@recruitflow.local', 'Password123!');   // Recruiter
  const hassan = await login('hassan.ali@recruitflow.local', 'Password123!');   // Hiring Manager
  const aya = await login('aya.mostafa@recruitflow.local', 'Password123!');     // Interviewer
  const tarek = await login('tarek.kamal@acme-health.local', 'Password123!');  // Org B user
  const noCookie = '';

  // ─── Section A: Unauthenticated access returns 401 ───────────
  console.log('\n[A] UNAUTHENTICATED ACCESS — Expected: 401 on all protected endpoints');

  const anonRoutes = [
    '/api/v1/candidates', '/api/v1/applications', '/api/v1/vacancies',
    '/api/v1/vacancy-requests', '/api/v1/interviews', '/api/v1/offers',
    '/api/v1/users', '/api/v1/audit-logs', '/api/v1/roles',
    '/api/v1/notifications', '/api/v1/tasks',
  ];
  for (const path of anonRoutes) {
    const res = await request({ hostname: 'localhost', port: 3000, path, method: 'GET' });
    check(`Anonymous GET ${path}`, res.status === 401, `got ${res.status}`);
  }

  // Public endpoints must still return 2xx without a cookie
  const pubHealth = await request({ hostname: 'localhost', port: 3000, path: '/api/v1/health', method: 'GET' });
  check('Public GET /health accessible without cookie', pubHealth.status < 400, `got ${pubHealth.status}`);

  // ─── Section B: Invalid/malformed session tokens rejected safely ──
  console.log('\n[B] INVALID SESSION TOKENS — Expected: 401, no internal leakage');

  const invalidTokenRoutes = ['/api/v1/candidates', '/api/v1/vacancies'];
  for (const path of invalidTokenRoutes) {
    const res = await request({
      hostname: 'localhost', port: 3000, path, method: 'GET',
      headers: { Cookie: 'auth_token=definitely.not.valid.jwt.token' },
    });
    check(`Forged JWT cookie rejected on ${path}`, res.status === 401, `got ${res.status}`);
    check(`No internal leak in 401 body for ${path}`, isSafe(res.body), `body: ${JSON.stringify(res.body)}`);
  }

  // ─── Section C: Valid authenticated users access permitted routes ─
  console.log('\n[C] VALID AUTHENTICATED USERS — Expected: 200 on permitted routes');

  const adminRoutes = ['/api/v1/users', '/api/v1/roles', '/api/v1/audit-logs', '/api/v1/candidates'];
  for (const path of adminRoutes) {
    const res = await request({ hostname: 'localhost', port: 3000, path, method: 'GET', headers: { Cookie: ahmed.cookie } });
    check(`Admin (Ahmed) GET ${path}`, res.status === 200, `got ${res.status}`);
  }

  const recruiterRoutes = ['/api/v1/candidates', '/api/v1/applications', '/api/v1/vacancies'];
  for (const path of recruiterRoutes) {
    const res = await request({ hostname: 'localhost', port: 3000, path, method: 'GET', headers: { Cookie: sarah.cookie } });
    check(`Recruiter (Sarah) GET ${path}`, res.status === 200, `got ${res.status}`);
  }

  const hiringMgrRoutes = ['/api/v1/vacancy-requests'];
  for (const path of hiringMgrRoutes) {
    const res = await request({ hostname: 'localhost', port: 3000, path, method: 'GET', headers: { Cookie: hassan.cookie } });
    check(`Hiring Manager (Hassan) GET ${path}`, res.status === 200, `got ${res.status}`);
  }

  const interviewerRoutes = ['/api/v1/interviews'];
  for (const path of interviewerRoutes) {
    const res = await request({ hostname: 'localhost', port: 3000, path, method: 'GET', headers: { Cookie: aya.cookie } });
    check(`Interviewer (Aya) GET ${path}`, res.status === 200, `got ${res.status}`);
  }

  // ─── Section D: Insufficient permissions return controlled 403 ─
  console.log('\n[D] INSUFFICIENT PERMISSIONS — Expected: 403 Forbidden, safe message');

  const forbiddenCases = [
    { persona: 'Recruiter', cookie: sarah.cookie, path: '/api/v1/users', method: 'GET' },
    { persona: 'Recruiter', cookie: sarah.cookie, path: '/api/v1/users', method: 'POST' },
    { persona: 'Recruiter', cookie: sarah.cookie, path: '/api/v1/audit-logs', method: 'GET' },
    { persona: 'Hiring Manager', cookie: hassan.cookie, path: '/api/v1/users', method: 'GET' },
    { persona: 'Hiring Manager', cookie: hassan.cookie, path: '/api/v1/audit-logs', method: 'GET' },
    { persona: 'Interviewer', cookie: aya.cookie, path: '/api/v1/users', method: 'GET' },
    { persona: 'Interviewer', cookie: aya.cookie, path: '/api/v1/vacancy-requests', method: 'POST' },
  ];

  for (const { persona, cookie, path, method } of forbiddenCases) {
    const res = await request({ hostname: 'localhost', port: 3000, path, method, headers: { Cookie: cookie } }, method === 'POST' ? {} : undefined);
    check(`${persona} ${method} ${path} returns 403`, res.status === 403, `got ${res.status}`);
    check(`403 response body is safe (no SQL/Prisma)`, isSafe(res.body), `body: ${JSON.stringify(res.body)?.slice(0, 100)}`);
    // Verify the message is the controlled message
    const msg = res.body?.message || '';
    check(`403 message is controlled`, msg.includes('Access denied') || msg.includes('insufficient') || msg.includes('permission'), `msg: ${msg}`);
  }

  // ─── Section E: Cross-tenant access returns uniform 404 ────────
  console.log('\n[E] CROSS-TENANT ACCESS — Expected: 404 Not Found (zero leakage)');

  const orgBCandidateId = '20000000-0000-4000-8000-000000000020';
  const fakeId = '00000000-0000-4000-8000-000000000099';

  const crossTenantCases = [
    { label: 'Org A user GET Org B candidate', path: `/api/v1/candidates/${orgBCandidateId}`, cookie: ahmed.cookie },
    { label: 'Org A user PATCH Org B candidate', path: `/api/v1/candidates/${orgBCandidateId}`, method: 'PATCH', cookie: ahmed.cookie },
    { label: 'Nonexistent candidate UUID', path: `/api/v1/candidates/${fakeId}`, cookie: ahmed.cookie },
    { label: 'Nonexistent application UUID', path: `/api/v1/applications/${fakeId}`, cookie: ahmed.cookie },
    { label: 'Nonexistent vacancy request UUID', path: `/api/v1/vacancy-requests/${fakeId}`, cookie: ahmed.cookie },
  ];

  for (const { label, path, cookie, method = 'GET' } of crossTenantCases) {
    const res = await request(
      { hostname: 'localhost', port: 3000, path, method, headers: { Cookie: cookie } },
      method === 'PATCH' ? { currentTitle: 'Attack' } : undefined
    );
    check(`${label} returns 404`, res.status === 404, `got ${res.status}`);
    check(`${label} body is safe`, isSafe(res.body), `body: ${JSON.stringify(res.body)?.slice(0, 100)}`);
    // Ensure the response is NOT 200 with org B data
    check(`${label} does not expose Org B data`, res.status !== 200, `got ${res.status}`);
    // Ensure it's NOT a 403 (which would disclose that the resource exists but is forbidden)
    check(`${label} does not return 403 (prevents probing)`, res.status !== 403, `got ${res.status}`);
  }

  // Also verify Org B user cannot access Org A data
  const orgACandidateRes = await request({
    hostname: 'localhost', port: 3000,
    path: '/api/v1/candidates', method: 'GET',
    headers: { Cookie: tarek.cookie },
  });
  check('Org B user (Tarek) sees only Org B candidates', orgACandidateRes.status === 200 || orgACandidateRes.status === 403, `got ${orgACandidateRes.status}`);
  if (orgACandidateRes.status === 200 && orgACandidateRes.body?.data) {
    const hasOrgAData = (orgACandidateRes.body.data || []).some(
      (c) => c.organizationId === '10000000-0000-4000-8000-000000000001'
    );
    check('Org B user response contains zero Org A candidates', !hasOrgAData, `found Org A data: ${hasOrgAData}`);
  }

  // ─── Section F: Invalid UUIDs and malformed payloads ───────────
  console.log('\n[F] INPUT VALIDATION — Expected: safe error responses (400/422), no internal leakage');

  const invalidUuidCases = [
    { label: 'Invalid UUID in candidate path', path: '/api/v1/candidates/not-a-uuid', cookie: ahmed.cookie },
    { label: 'Invalid UUID in application path', path: '/api/v1/applications/not-a-uuid', cookie: ahmed.cookie },
    { label: 'Invalid UUID in vacancy-request path', path: '/api/v1/vacancy-requests/not-a-uuid', cookie: ahmed.cookie },
  ];

  for (const { label, path, cookie } of invalidUuidCases) {
    const res = await request({ hostname: 'localhost', port: 3000, path, method: 'GET', headers: { Cookie: cookie } });
    check(`${label} returns non-200`, res.status !== 200, `got ${res.status}`);
    check(`${label} body is safe (no SQL/Prisma)`, isSafe(res.body), `body: ${JSON.stringify(res.body)?.slice(0, 100)}`);
  }

  // Missing required fields in POST
  const missingFieldsCandidateRes = await request(
    { hostname: 'localhost', port: 3000, path: '/api/v1/candidates', method: 'POST', headers: { Cookie: ahmed.cookie } },
    { firstName: '' } // missing lastName and email
  );
  check('POST /candidates with missing required fields returns 400', missingFieldsCandidateRes.status === 400, `got ${missingFieldsCandidateRes.status}`);
  check('Missing fields response body is safe', isSafe(missingFieldsCandidateRes.body), `body: ${JSON.stringify(missingFieldsCandidateRes.body)?.slice(0, 100)}`);

  // Malformed JSON in request body
  const malformedRes = await request({
    hostname: 'localhost', port: 3000,
    path: '/api/v1/candidates', method: 'POST',
    headers: { Cookie: ahmed.cookie, 'Content-Type': 'application/json', 'Content-Length': '15' },
  }, 'this is not json');
  check('Malformed JSON body returns 400', malformedRes.status === 400, `got ${malformedRes.status}`);
  check('Malformed JSON body response is safe', isSafe(malformedRes.body), `body: ${JSON.stringify(malformedRes.body)?.slice(0, 100)}`);

  // ─── Section G: Route-level coverage across domains ─────────────
  console.log('\n[G] DOMAIN ROUTE COVERAGE — All primary resource types');

  const domainRoutes = [
    { path: '/api/v1/candidates', label: 'Candidates list' },
    { path: '/api/v1/applications', label: 'Applications list' },
    { path: '/api/v1/vacancies', label: 'Vacancies list' },
    { path: '/api/v1/vacancy-requests', label: 'Vacancy Requests list' },
    { path: '/api/v1/interviews', label: 'Interviews list' },
    { path: '/api/v1/offers', label: 'Offers list' },
  ];

  for (const { path, label } of domainRoutes) {
    const res = await request({ hostname: 'localhost', port: 3000, path, method: 'GET', headers: { Cookie: ahmed.cookie } });
    check(`${label} accessible by Admin`, res.status === 200, `got ${res.status}`);
    // For 200 success responses, just verify the response structure is valid (not an error body)
    const isSuccessful = res.status === 200 && (Array.isArray(res.body?.data) || Array.isArray(res.body) || typeof res.body === 'object');
    check(`${label} response is valid JSON`, isSuccessful, `status: ${res.status}`);
  }

  // ─── Section H: Response safety — no internal metadata leaked ──
  console.log('\n[H] RESPONSE SAFETY — Error responses must not expose internal details');

  const safetyChecks = [
    { label: '401 response body', path: '/api/v1/users', method: 'GET', cookie: '' },
    { label: '403 response body', path: '/api/v1/users', method: 'GET', cookie: sarah.cookie },
    { label: '404 response body', path: `/api/v1/candidates/${fakeId}`, method: 'GET', cookie: ahmed.cookie },
  ];

  for (const { label, path, method, cookie } of safetyChecks) {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    const res = await request({ hostname: 'localhost', port: 3000, path, method, headers });
    check(`${label} contains no Prisma/SQL/stack trace`, isSafe(res.body), `body: ${JSON.stringify(res.body)?.slice(0, 200)}`);
  }

  // ─── Summary ─────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log(`P3.6 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  if (failed === 0) {
    console.log('ALL P3.6 SECURITY VERIFICATION TESTS PASSED ✅');
  } else {
    console.log(`❌ ${failed} test(s) FAILED — investigate above`);
    process.exit(1);
  }
}

runP36Suite().catch(e => {
  console.error('SUITE CRASHED:', e.message);
  process.exit(1);
});
