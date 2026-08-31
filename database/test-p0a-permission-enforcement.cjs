/**
 * P0-A — Dormant Permission Enforcement Verification Suite
 *
 * Verifies that previously dormant permissions are actually enforced:
 *   1. VIEW_CANDIDATE_PII    — candidate email/phone masked without it, exposed with it
 *   2. VIEW_CURRENT_SALARY   — offer compensation nulled without it, exposed with it
 *   3. DOWNLOAD_DOCUMENTS    — document download + CV-bank manifest gated by it
 *
 * Personas (from seed):
 *   ahmed.mahmoud  — ADMINISTRATOR/HR_MANAGER/... : has ALL three permissions
 *   hassan.ali     — HIRING_MANAGER               : CANDIDATE_VIEW only (no PII/salary/download)
 *   omar.nasser    — LICENSE_SPECIALIST           : DOWNLOAD_DOCUMENTS but NO CANDIDATE_VIEW
 *
 * Read-only suite: performs no mutations and requires no teardown.
 */

const API_PORT = Number(process.env.P0A_API_PORT || 3000);

const http = require('http');

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
        resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
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

async function runP0ASuite() {
  console.log('=== P0-A DORMANT PERMISSION ENFORCEMENT VERIFICATION ===\n');

  // ── Login personas ───────────────────────────────────────
  const ahmed = await login('ahmed.mahmoud@recruitflow.local', 'Password123!');
  const hassan = await login('hassan.ali@recruitflow.local', 'Password123!');
  const omar = await login('omar.nasser@recruitflow.local', 'Password123!');

  check('Ahmed login succeeds (has all three permissions)', ahmed.status === 200 && !!ahmed.cookie, `status: ${ahmed.status}`);
  check('Hassan login succeeds (HIRING_MANAGER)', hassan.status === 200 && !!hassan.cookie, `status: ${hassan.status}`);
  check('Omar login succeeds (LICENSE_SPECIALIST)', omar.status === 200 && !!omar.cookie, `status: ${omar.status}`);

  check(
    'Seed sanity: Hassan lacks the three dormant permissions',
    hassan.profile
    && !hassan.profile.permissions.includes('VIEW_CANDIDATE_PII')
    && !hassan.profile.permissions.includes('VIEW_CURRENT_SALARY')
    && !hassan.profile.permissions.includes('DOWNLOAD_DOCUMENTS'),
  );
  check(
    'Seed sanity: Ahmed holds the three dormant permissions',
    ahmed.profile
    && ahmed.profile.permissions.includes('VIEW_CANDIDATE_PII')
    && ahmed.profile.permissions.includes('VIEW_CURRENT_SALARY')
    && ahmed.profile.permissions.includes('DOWNLOAD_DOCUMENTS'),
  );

  // ── Section 1: VIEW_CANDIDATE_PII ────────────────────────
  console.log('\n[1] VIEW_CANDIDATE_PII ENFORCEMENT');

  const listRes = await request({
    hostname: 'localhost', port: API_PORT,
    path: '/api/v1/candidates?pageSize=5', method: 'GET',
    headers: { Cookie: hassan.cookie },
  });
  check('Hassan can list candidates (CANDIDATE_VIEW)', listRes.status === 200, `status: ${listRes.status}`);

  const candidates = Array.isArray(listRes.body?.data)
    ? listRes.body.data
    : Array.isArray(listRes.body) ? listRes.body : [];
  check('Candidate list non-empty for assertions', candidates.length > 0, `count: ${candidates.length}`);
  const target = candidates[0];

  const maskRe = /\u2022/;
  const allListMasked = candidates.every((c) => maskRe.test(c.email || '') || c.email === 'restricted');
  check('Hassan: list emails are masked', allListMasked, `sample: ${target?.email}`);
  const anyRawPhoneLeakInList = candidates.some((c) => c.phone && !maskRe.test(c.phone));
  check('Hassan: no unmasked phones in list', !anyRawPhoneLeakInList);

  const candId = target?.id;
  const hassanDetail = await request({
    hostname: 'localhost', port: API_PORT,
    path: `/api/v1/candidates/${candId}`, method: 'GET',
    headers: { Cookie: hassan.cookie },
  });
  check('Hassan can fetch candidate detail (CANDIDATE_VIEW)', hassanDetail.status === 200, `status: ${hassanDetail.status}`);
  check(
    'Hassan: detail email is masked',
    hassanDetail.status === 200 && (maskRe.test(hassanDetail.body?.email || '') || hassanDetail.body?.email === 'restricted'),
    `email: ${hassanDetail.body?.email}`,
  );

  const ahmedDetail = await request({
    hostname: 'localhost', port: API_PORT,
    path: `/api/v1/candidates/${candId}`, method: 'GET',
    headers: { Cookie: ahmed.cookie },
  });
  check('Ahmed can fetch candidate detail', ahmedDetail.status === 200, `status: ${ahmedDetail.status}`);
  check(
    'Ahmed: detail email fully visible (not masked)',
    ahmedDetail.status === 200 && !!ahmedDetail.body?.email && !maskRe.test(ahmedDetail.body.email),
    `email: ${ahmedDetail.body?.email}`,
  );
  check(
    'Ahmed sees a different (unmasked) email than Hassan for the same candidate',
    ahmedDetail.body?.email !== hassanDetail.body?.email,
  );

  // ── Section 2: VIEW_CURRENT_SALARY ───────────────────────
  console.log('\n[2] VIEW_CURRENT_SALARY ENFORCEMENT');

  const ahmedOffers = await request({
    hostname: 'localhost', port: API_PORT,
    path: '/api/v1/offers?pageSize=5', method: 'GET',
    headers: { Cookie: ahmed.cookie },
  });
  check('Ahmed can list offers (APPLICATION_VIEW)', ahmedOffers.status === 200, `status: ${ahmedOffers.status}`);
  const offers = Array.isArray(ahmedOffers.body?.data)
    ? ahmedOffers.body.data
    : Array.isArray(ahmedOffers.body) ? ahmedOffers.body : [];
  check('Offer list non-empty for assertions', offers.length > 0, `count: ${offers.length}`);

  const offerId = offers[0]?.id;
  const hassanOffer = await request({
    hostname: 'localhost', port: API_PORT,
    path: `/api/v1/offers/${offerId}`, method: 'GET',
    headers: { Cookie: hassan.cookie },
  });
  check('Hassan can fetch offer detail (APPLICATION_VIEW)', hassanOffer.status === 200, `status: ${hassanOffer.status}`);
  const hVersion = hassanOffer.body?.currentVersion;
  check(
    'Hassan: offer compensation amount is null (salary hidden)',
    hassanOffer.status === 200 && (hVersion == null || hVersion.monthlyPackage == null),
    `monthlyPackage: ${hVersion?.monthlyPackage}`,
  );

  const ahmedOffer = await request({
    hostname: 'localhost', port: API_PORT,
    path: `/api/v1/offers/${offerId}`, method: 'GET',
    headers: { Cookie: ahmed.cookie },
  });
  const aVersion = ahmedOffer.body?.currentVersion;
  check(
    'Ahmed: offer compensation amount visible (number > 0)',
    ahmedOffer.status === 200 && typeof aVersion?.monthlyPackage === 'number' && aVersion.monthlyPackage > 0,
    `monthlyPackage: ${aVersion?.monthlyPackage}`,
  );

  // ── Section 3: DOWNLOAD_DOCUMENTS ────────────────────────
  console.log('\n[3] DOWNLOAD_DOCUMENTS ENFORCEMENT');

  const hassanManifest = await request({
    hostname: 'localhost', port: API_PORT,
    path: '/api/v1/documents/cv-bank/manifest.xlsx', method: 'GET',
    headers: { Cookie: hassan.cookie },
  });
  check('Hassan blocked from CV-bank manifest (no DOWNLOAD_DOCUMENTS)', hassanManifest.status === 403, `status: ${hassanManifest.status}`);

  const omarManifest = await request({
    hostname: 'localhost', port: API_PORT,
    path: '/api/v1/documents/cv-bank/manifest.xlsx', method: 'GET',
    headers: { Cookie: omar.cookie },
  });
  check('Omar blocked from CV-bank manifest (no CANDIDATE_VIEW)', omarManifest.status === 403, `status: ${omarManifest.status}`);

  const docsList = await request({
    hostname: 'localhost', port: API_PORT,
    path: `/api/v1/documents/candidate/${hassanDetail.body?.candidateId ?? target?.id}`, method: 'GET',
    headers: { Cookie: ahmed.cookie },
  });
  let docId = null;
  if (Array.isArray(docsList.body?.items) && docsList.body.items.length > 0) {
    docId = docsList.body.items[0].id;
  } else {
    docId = '20000000-0000-4000-8000-000000000600';
  }

  const hassanDownload = await request({
    hostname: 'localhost', port: API_PORT,
    path: `/api/v1/documents/${docId}/download`, method: 'GET',
    headers: { Cookie: hassan.cookie },
  });
  check('Hassan blocked from document download (403)', hassanDownload.status === 403, `status: ${hassanDownload.status}`);

  const omarDownload = await request({
    hostname: 'localhost', port: API_PORT,
    path: `/api/v1/documents/${docId}/download`, method: 'GET',
    headers: { Cookie: omar.cookie },
  });
  check('Omar blocked from document download (missing CANDIDATE_VIEW, 403)', omarDownload.status === 403, `status: ${omarDownload.status}`);

  const ahmedDownload = await request({
    hostname: 'localhost', port: API_PORT,
    path: `/api/v1/documents/${docId}/download`, method: 'GET',
    headers: { Cookie: ahmed.cookie },
  });
  check(
    'Ahmed passes permission gate on document download (not 401/403)',
    ahmedDownload.status !== 401 && ahmedDownload.status !== 403,
    `status: ${ahmedDownload.status}`,
  );

  // ── Summary ──────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log(`P0-A TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) {
    console.log('\u274C Failures:');
    for (const f of failures) console.log(`   - ${f}`);
    process.exitCode = 1;
  } else {
    console.log('ALL P0-A PERMISSION ENFORCEMENT TESTS PASSED \u2705');
  }
}

runP0ASuite().catch((err) => {
  console.error(`SUITE CRASHED: ${err.message}`);
  process.exitCode = 1;
});
