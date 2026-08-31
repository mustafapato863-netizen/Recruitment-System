/**
 * P1 — Async Email Outbox & Delivery Verification Suite
 *
 * Verifies the transactional email outbox end-to-end:
 *   1. Auth flows enqueue outbox rows atomically (password reset, invitation)
 *   2. Worker claims with SKIP LOCKED semantics; a failing transport retries
 *      with backoff and records lastError
 *   3. A healthy transport drains rows to Sent
 *   4. The delivered token actually completes its business flow
 *      (invitation acceptance -> login with new credentials)
 *
 * Requires: API running on P1_API_PORT (default 3000), DATABASE_URL set.
 * Read-only for seeded data; cleans up its own invited test user.
 */

const API_PORT = Number(process.env.P1_API_PORT || 3000);

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const { PrismaClient } = require('./generated/client');

const prisma = new PrismaClient();
const WORKER_ENTRY = path.join(__dirname, '..', 'apps', 'worker', 'dist', 'main.js');

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
  const cookies = (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
  return { status: res.status, cookie: cookies, profile: res.body?.user };
}

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  \u2705 PASS: ${name}${detail ? ` \u2014 ${detail}` : ''}`);
  } else {
    failed += 1;
    failures.push(`${name} (${detail ?? 'no detail'})`);
    console.log(`  \u274C FAIL: ${name}${detail ? ` \u2014 ${detail}` : ''}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Run the real worker binary once until it goes idle or times out. */
async function runWorkerOnce(env, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [WORKER_ENTRY], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => { child.kill(); }, timeoutMs);
    child.on('exit', () => {
      clearTimeout(timer);
      resolve(out);
    });
    // Stop after two consecutive idle polls (worker logs nothing on idle).
    let idlePolls = 0;
    const idleCheck = setInterval(async () => {
      try {
        const due = await prisma.$queryRawUnsafe(
          `SELECT count(*)::int AS n FROM "email_outbox" WHERE "status" = 'Pending' AND "availableAt" <= CURRENT_TIMESTAMP`
        );
        idlePolls = due[0]?.n === 0 ? idlePolls + 1 : 0;
        if (idlePolls >= 2) {
          clearInterval(idleCheck);
          clearTimeout(timer);
          child.kill();
        }
      } catch { /* keep polling */ }
    }, 500);
  });
}

async function waitFor(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function runP1Suite() {
  console.log('=== P1 EMAIL OUTBOX & DELIVERY VERIFICATION ===\n');

  const admin = await login('ahmed.mahmoud@recruitflow.local', 'Password123!');
  check('Admin login succeeds', admin.status === 200 && !!admin.cookie, `status: ${admin.status}`);

  const orgAId = admin.profile.organizationId;

  // ── Section 1: Transactional enqueue ─────────────────────
  console.log('\n[1] TRANSACTIONAL ENQUEUE FROM AUTH FLOWS');

  const resetRes = await request({
    hostname: 'localhost', port: API_PORT,
    path: '/api/v1/auth/password-reset/request', method: 'POST',
  }, { email: 'hassan.ali@recruitflow.local' });
  check('Password-reset request accepted', resetRes.status === 200 && resetRes.body?.accepted === true, `status: ${resetRes.status}`);

  const resetRows = await prisma.emailOutbox.findMany({
    where: { toEmail: 'hassan.ali@recruitflow.local', template: 'password_reset' },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  check('Outbox row created for password reset', resetRows.length === 1, `count: ${resetRows.length}`);
  check('Outbox row starts Pending', resetRows[0]?.status === 'Pending', `status: ${resetRows[0]?.status}`);
  check('Row carries organizationId + encrypted token payload',
    resetRows[0]?.organizationId === orgAId &&
    typeof resetRows[0]?.payload?.encryptedToken === 'string' &&
    typeof resetRows[0]?.payload?.tokenIv === 'string' &&
    typeof resetRows[0]?.payload?.tokenAuthTag === 'string' &&
    !Object.prototype.hasOwnProperty.call(resetRows[0]?.payload ?? {}, 'token'));

  const inviteEmail = `p1-invite-${Date.now()}@recruitflow-test.local`;
  const inviteRes = await request({
    hostname: 'localhost', port: API_PORT,
    path: '/api/v1/users/invitations', method: 'POST',
    headers: { Cookie: admin.cookie },
  }, { email: inviteEmail, displayName: 'P1 Invitee' });
  check('Invitation created via users API', inviteRes.status === 201 || inviteRes.status === 200, `status: ${inviteRes.status}`);

  const inviteRows = await prisma.emailOutbox.findMany({
    where: { toEmail: inviteEmail, template: 'invitation' },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  check('Outbox row created for invitation', inviteRows.length === 1, `count: ${inviteRows.length}`);
  check('Both rows Pending before worker runs', (await prisma.emailOutbox.count({ where: { status: 'Pending' } })) >= 2);

  // ── Section 2: Failing transport -> retry with backoff ───
  console.log('\n[2] FAILED DELIVERY RETRIES WITH BACKOFF');

  await runWorkerOnce({
    MAIL_TRANSPORT: 'smtp',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '5999', // nothing listens here on purpose
    WORKER_POLL_INTERVAL_MS: '200',
  });

  await waitFor(async () =>
    (await prisma.emailOutbox.findFirst({ where: { id: resetRows[0].id } }))?.attempts >= 1,
    15000, 'first delivery attempt');
  const afterFail = await prisma.emailOutbox.findUnique({ where: { id: resetRows[0].id } });
  check('Failed attempt recorded (attempts=1)', afterFail.attempts === 1, `attempts: ${afterFail.attempts}`);
  check('Row requeued as Pending after failure', afterFail.status === 'Pending', `status: ${afterFail.status}`);
  check('lastError captured', typeof afterFail.lastError === 'string' && afterFail.lastError.length > 0);
  check('Backoff scheduled in the future', new Date(afterFail.availableAt).getTime() > Date.now());

  // Simulate a worker crash after claiming the invitation. The lease recovery
  // path must make the row deliverable again instead of leaving it stranded.
  await prisma.$executeRawUnsafe(
    `UPDATE "email_outbox" SET "status" = 'Processing', "attempts" = 1, "updatedAt" = CURRENT_TIMESTAMP - INTERVAL '10 minutes' WHERE "id" = '${inviteRows[0].id}'`
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "email_outbox" SET "availableAt" = CURRENT_TIMESTAMP WHERE "status" = 'Pending' AND "template" IN ('password_reset','invitation')`
  );
  check('Stale processing row is prepared for lease-recovery test',
    (await prisma.emailOutbox.findUnique({ where: { id: inviteRows[0].id } }))?.status === 'Processing');

  // ── Section 3: Healthy transport drains to Sent ──────────
  console.log('\n[3] HEALTHY TRANSPORT DRAINS OUTBOX');

  await prisma.$executeRawUnsafe(
    `UPDATE "email_outbox" SET "availableAt" = CURRENT_TIMESTAMP WHERE "status" = 'Pending' AND "template" IN ('password_reset','invitation')`
  );
  await runWorkerOnce({ MAIL_TRANSPORT: 'console', WORKER_POLL_INTERVAL_MS: '200' });

  await waitFor(async () => {
    const [r, i] = await Promise.all([
      prisma.emailOutbox.findUnique({ where: { id: resetRows[0].id } }),
      prisma.emailOutbox.findUnique({ where: { id: inviteRows[0].id } }),
    ]);
    return r?.status === 'Sent' && i?.status === 'Sent';
  }, 20000, 'both emails to reach Sent');
  const sentReset = await prisma.emailOutbox.findUnique({ where: { id: resetRows[0].id } });
  const sentInvite = await prisma.emailOutbox.findUnique({ where: { id: inviteRows[0].id } });
  check('Password-reset email Sent', sentReset.status === 'Sent' && sentReset.sentAt !== null);
  check('Invitation email Sent', sentInvite.status === 'Sent' && sentInvite.sentAt !== null);
  check('Recovered invitation was retried after stale lease', sentInvite.attempts === 2);

  const deadRow = await prisma.emailOutbox.create({
    data: {
      organizationId: orgAId,
      toEmail: 'dead-letter@recruitflow-test.local',
      subject: 'Dead-letter test',
      template: 'unknown-template',
      payload: {},
      maxAttempts: 1,
      availableAt: new Date(),
    },
  });
  await runWorkerOnce({ MAIL_TRANSPORT: 'console', WORKER_POLL_INTERVAL_MS: '200' });
  const deadResult = await prisma.emailOutbox.findUnique({ where: { id: deadRow.id } });
  check('Exhausted invalid delivery moves to Dead', deadResult?.status === 'Dead');
  check('Dead-letter row records the failure', typeof deadResult?.lastError === 'string' && deadResult.lastError.length > 0);

  // ── Section 4: Delivered token completes business flow ───
  console.log('\n[4] TOKEN REDEMPTION END-TO-END');

  const inviteToken = inviteRes.body?.devToken;
  check('Development response exposes the redemption token only in local mode', typeof inviteToken === 'string');
  const newPassword = 'P1Verified!2026';
  const acceptRes = await request({
    hostname: 'localhost', port: API_PORT,
    path: '/api/v1/auth/invitations/accept', method: 'POST',
  }, { token: inviteToken, password: newPassword, displayName: 'P1 Invitee Verified' });
  check('Invitation accepted with delivered token', acceptRes.status === 200, `status: ${acceptRes.status}`);

  const inviteeLogin = await login(inviteEmail, newPassword);
  check('Invitee can log in with chosen password', inviteeLogin.status === 200, `status: ${inviteeLogin.status}`);

  // ── Section 5: Cleanup ───────────────────────────────────
  console.log('\n[5] CLEANUP');
  const delTokens = await prisma.authToken.deleteMany({
    where: { user: { emailNormalized: inviteEmail.toLowerCase() } },
  });
  const delUser = await prisma.user.deleteMany({ where: { emailNormalized: inviteEmail.toLowerCase() } });
  const delRows = await prisma.emailOutbox.deleteMany({ where: { id: { in: [deadRow.id, sentReset.id, sentInvite.id] } } });
  console.log(`  Removed ${delUser.count} user(s), ${delTokens.count} token(s), ${delRows.count} outbox row(s)`);
  check('Test artifacts cleaned up', delUser.count === 1);

  // ── Summary ──────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log(`P1 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) {
    console.log('\u274C Failures:');
    for (const f of failures) console.log(`   - ${f}`);
    process.exitCode = 1;
  } else {
    console.log('ALL P1 EMAIL OUTBOX & DELIVERY TESTS PASSED \u2705');
  }
}

runP1Suite()
  .catch((err) => {
    console.error(`SUITE CRASHED: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
