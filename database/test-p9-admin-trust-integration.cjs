/**
 * P9 — Administration, integrations, reports, and audit acceptance suite.
 *
 * This suite verifies that administrative and trust surfaces are available to
 * the correct persona, return organization-safe payloads, and do not expose
 * internal implementation details in controlled errors.
 */

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
        try { parsed = data ? JSON.parse(data) : null; } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login(email) {
  const response = await request({
    hostname: 'localhost', port: 3000,
    path: '/api/v1/auth/login', method: 'POST',
  }, { email, password: 'Password123!' });
  const cookie = (response.headers['set-cookie'] || []).map((value) => value.split(';')[0]).join('; ');
  return { status: response.status, cookie };
}

function isSafe(body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  return !/(PrismaClient|SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|passwordHash|stack trace|syntax error)/i.test(text);
}

async function run() {
  let passed = 0;
  let failed = 0;

  function assert(name, condition, details) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed += 1;
    } else {
      console.error(`[FAIL] ${name}${details ? ` — ${JSON.stringify(details)}` : ''}`);
      failed += 1;
    }
  }

  const admin = await login('ahmed.mahmoud@recruitflow.local');
  const recruiter = await login('sarah.ahmed@recruitflow.local');
  assert('Administrator login succeeds', admin.status === 200 && !!admin.cookie);
  assert('Recruiter login succeeds', recruiter.status === 200 && !!recruiter.cookie);

  const adminRoutes = [
    ['/users', 'users list'],
    ['/roles', 'roles list'],
    ['/roles/permissions', 'permission registry'],
    ['/organizations', 'organizations'],
    ['/branches', 'branches'],
    ['/positions', 'positions'],
    ['/pipeline-templates', 'pipeline templates'],
    ['/integrations', 'integrations'],
    ['/reports/kpis', 'report KPIs'],
    ['/reports/funnel', 'report funnel'],
    ['/reports/hiring-by-department', 'department report'],
    ['/reports/recruiter-workload', 'recruiter workload report'],
    ['/audit-logs', 'audit log'],
  ];

  for (const [path, label] of adminRoutes) {
    const response = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1${path}`, method: 'GET',
      headers: { Cookie: admin.cookie },
    });
    assert(`Administrator can read ${label}`, response.status === 200);
    assert(`${label} payload is safe`, isSafe(response.body));
  }

  const recruiterRestrictedRoutes = [
    ['/users', 'users administration'],
    ['/roles', 'roles administration'],
    ['/audit-logs', 'audit log'],
  ];

  for (const [path, label] of recruiterRestrictedRoutes) {
    const response = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1${path}`, method: 'GET',
      headers: { Cookie: recruiter.cookie },
    });
    assert(`Recruiter is denied ${label}`, response.status === 403);
    assert(`${label} denial is safe`, isSafe(response.body));
  }

  for (const [path, label] of [['/pipeline-templates', 'workflow settings'], ['/integrations', 'integration catalog']]) {
    const response = await request({
      hostname: 'localhost', port: 3000,
      path: `/api/v1${path}`, method: 'GET',
      headers: { Cookie: recruiter.cookie },
    });
    assert(`Recruiter can read ${label} when granted view access`, response.status === 200);
    assert(`${label} read payload is safe`, isSafe(response.body));
  }

  const anonymous = await request({
    hostname: 'localhost', port: 3000,
    path: '/api/v1/audit-logs', method: 'GET',
  });
  assert('Anonymous audit access is denied', anonymous.status === 401);
  assert('Anonymous denial is safe', isSafe(anonymous.body));

  console.log(`P9 Admin & Trust Results: ${passed} PASSED, ${failed} FAILED`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
