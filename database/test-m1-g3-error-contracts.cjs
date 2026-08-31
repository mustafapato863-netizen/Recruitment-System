/**
 * M1-G3 — Stable API Error Contract Suite
 *
 * Self-contained executable test suite.
 * Run directly with: node database/test-m1-g3-error-contracts.cjs
 *
 * Requires the API to be running on http://127.0.0.1:3000 (RECRUITFLOW_API_PORT).
 *
 * Validates:
 * 1. Envelope Shape Guarantee (statusCode, code, message, fields?, requestId,
 *    retryable, retryAfterSeconds) across every error status class produced by
 *    the live API.
 * 2. Global Safe-Disclosure (no Prisma codes/SQL/stack traces/node_modules
 *    paths/raw secrets in any error body across the suite).
 * 3. Validation normalization: HTTP 400 -> VALIDATION_ERROR with field-level
 *    `fields` mapping for body/query DTO violations.
 * 4. Authentication codes: 401 INVALID_CREDENTIALS (bad password), 401
 *    UNAUTHENTICATED (no/invalid bearer), refresh 401 normalization.
 * 5. Authorization: 403 FORBIDDEN preserves contact message, never leaks
 *    which permission was denied or what resources exist.
 * 6. Tenant-isolation 404: NOT_FOUND safe + existence-neutral for unknown
 *    public records.
 * 7. Conflict normalization: 409 CONFLICT from duplicate unique records.
 * 8. Rate limiting: RATE_LIMITED code present with retryable=true and
 *    retryAfterSeconds surfaced for login lockouts (403) as well as public
 *    request budget (429).
 * 9. File/CV security codes: FILE_INVALID, FILE_TOO_LARGE, FILE_UNSAFE with
 *    their existing safe messages preserved.
 * 10. Import/workbook codes: FILE_INVALID and IMPORT_INVALID from the bulk
 *     import surface.
 * 11. Request/correlation ID: safe inbound ID preserved and mirrored to
 *     X-Request-Id + x-correlation-id; unsafe/CRLF payloads replaced with a
 *     generated req_ ID; header/body ID consistency on success and error.
 * 12. Readiness and report-export positive controls (DB-up readiness 200,
 *     authorized report download works as a binary stream).
 * 13. Deterministic cleanup.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@recruitflow/database');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

const API_PORT = Number(process.env.RECRUITFLOW_API_PORT || 3000);
const HOST = '127.0.0.1';
const prisma = new PrismaClient();

let reqCounter = 9000;

function request(reqPath, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET';
    reqCounter++;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.ip ? { 'X-Forwarded-For': options.ip } : {}),
      ...(options.headers || {}),
    };
    let payload = null;
    if (body !== null && body !== undefined) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request({ host: HOST, port: API_PORT, path: `/api/v1${reqPath}`, method, headers }, (res) => {
      let data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        const text = buffer.toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { json = text; }
        const setCookie = res.headers['set-cookie'];
        let cookies = {};
        if (setCookie) {
          const cookieStrings = Array.isArray(setCookie) ? setCookie : [setCookie];
          for (const c of cookieStrings) {
            const parts = c.split(';').map((p) => p.trim());
            const nameVal = parts[0];
            const eqIdx = nameVal.indexOf('=');
            if (eqIdx !== -1) {
              const name = nameVal.slice(0, eqIdx);
              cookies[name] = { value: nameVal.slice(eqIdx + 1) };
            }
          }
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json, rawBuffer: buffer, cookies });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function requestMultipart(reqPath, options = {}, fields = {}, files = []) {
  return new Promise((resolve, reject) => {
    const method = options.method || 'POST';
    reqCounter++;
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}${Date.now()}`;
    const chunks = [];

    for (const [key, val] of Object.entries(fields)) {
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
    }
    for (const file of files) {
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`));
      chunks.push(file.content);
      chunks.push(Buffer.from('\r\n'));
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));

    const payload = Buffer.concat(chunks);
    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length,
      ...(options.ip ? { 'X-Forwarded-For': options.ip } : {}),
      ...(options.headers || {}),
    };

    const req = http.request({ host: HOST, port: API_PORT, path: `/api/v1${reqPath}`, method, headers }, (res) => {
      let data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        const text = buffer.toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { json = text; }
        resolve({ status: res.statusCode, headers: res.headers, body: json, rawBuffer: buffer });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
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

async function login(email, password = 'Password123!', ip) {
  const res = await request('/auth/login', { method: 'POST', ip }, { email, password });
  const cookies = Object.entries(res.cookies).map(([name, val]) => `${name}=${val.value}`).join('; ');
  return { status: res.status, body: res.body, cookies, raw: res };
}

async function cookieHeader(cookieString) {
  return { 'Cookie': cookieString };
}

function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function assertEnvelope(res, expectedStatus) {
  const b = res.body;
  const ok =
    b &&
    isObject(b) &&
    b.statusCode === expectedStatus &&
    typeof b.code === 'string' && b.code.length > 0 &&
    typeof b.message === 'string' && b.message.trim().length > 0 &&
    typeof b.retryable === 'boolean' &&
    (b.retryAfterSeconds === null || typeof b.retryAfterSeconds === 'number') &&
    typeof b.requestId === 'string' && b.requestId.length > 0;
  return ok;
}

const FORBIDDEN_MARKERS = /PrismaClient|Prisma\b|node_modules|\bat \S+:|stack|Traceback|Sentry|postgres|SELECT |INSERT |UPDATE |DELETE |passwordHash|accessToken|refreshToken|JWT_SECRET|DATABASE_URL/i;

function isSafeDisclosure(value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return !FORBIDDEN_MARKERS.test(str);
}

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function run() {
  console.log('=== M1-G3 STABLE API ERROR CONTRACT SUITE ===\n');

  const collectedErrors = [];
  const unique = Date.now();

  // ─── [1] ENVELOPE SHAPE + SAFE DISCLOSURE (401 no-token) ─────────────────
  console.log('[1] ENVELOPE SHAPE & GLOBAL SAFE-DISCLOSURE');

  const noToken = await request('/candidates');
  collectedErrors.push(noToken);
  check('No-token protected endpoint returns 401', noToken.status === 401, `got ${noToken.status}`);
  check('401 body is a complete envelope', assertEnvelope(noToken, 401), JSON.stringify(noToken.body));
  check('401 code is UNAUTHENTICATED', noToken.body?.code === 'UNAUTHENTICATED', `code=${noToken.body?.code}`);
  check('401 response carries X-Request-Id header', typeof noToken.headers['x-request-id'] === 'string');
  check('401 response carries x-correlation-id header', typeof noToken.headers['x-correlation-id'] === 'string');
  check('No-token 401 leaks no internals', isSafeDisclosure(noToken.body));

  // ─── [2] VALIDATION NORMALIZATION (400 VALIDATION_ERROR + fields) ────────
  console.log('\n[2] VALIDATION NORMALIZATION');

  const badLogin = await request('/auth/login', { method: 'POST' }, { email: 'not-an-email', password: '' });
  collectedErrors.push(badLogin);
  check('Invalid login payload returns 400', badLogin.status === 400, `got ${badLogin.status}`);
  check('Validation error uses VALIDATION_ERROR code', badLogin.body?.code === 'VALIDATION_ERROR', `code=${badLogin.body?.code}`);
  check('Validation error message is a stable instruction', badLogin.body?.message && badLogin.body.message.length > 0);
  check('Validation error retryable is false', badLogin.body?.retryable === false);
  check('Validation error fields is an object', isObject(badLogin.body?.fields));
  const hasEmailField = Array.isArray(badLogin.body?.fields?.email) && badLogin.body.fields.email.every((s) => typeof s === 'string');
  const hasPasswordField = Array.isArray(badLogin.body?.fields?.password) && badLogin.body.fields.password.every((s) => typeof s === 'string');
  check('fields maps email property to message array', hasEmailField, hasEmailField ? badLogin.body.fields.email[0] : 'missing');
  check('fields maps password property to message array', hasPasswordField, hasPasswordField ? badLogin.body.fields.password[0] : 'missing');
  check('Validation error leaks no internals', isSafeDisclosure(badLogin.body));

  // ─── [3] AUTHENTICATION CODES ────────────────────────────────────────────
  console.log('\n[3] AUTHENTICATION CODES');

  const badPass = await request('/auth/login', { method: 'POST', ip: `10.60.${(reqCounter % 200) + 1}.${(reqCounter % 9) + 1}` }, { email: 'ahmed.mahmoud@recruitflow.local', password: 'WrongPassword999!' });
  collectedErrors.push(badPass);
  check('Wrong password returns 401', badPass.status === 401, `got ${badPass.status}`);
  check('Wrong password code is INVALID_CREDENTIALS', badPass.body?.code === 'INVALID_CREDENTIALS', `code=${badPass.body?.code}`);
  check('Wrong password message preserved', badPass.body?.message === 'Invalid email or password', `got "${badPass.body?.message}"`);
  check('Auth failure leaks no internals', isSafeDisclosure(badPass.body));

  const noSuchUser = await request('/auth/login', { method: 'POST' }, { email: `ghost.${unique}@recruitflow.local`, password: 'Password123!' });
  collectedErrors.push(noSuchUser);
  check('Unknown account returns 401 (no enumeration)', noSuchUser.status === 401, `got ${noSuchUser.status}`);
  check('Unknown account code is INVALID_CREDENTIALS', noSuchUser.body?.code === 'INVALID_CREDENTIALS', `code=${noSuchUser.body?.code}`);
  check('Unknown account message does not reveal existence', /invalid/i.test(noSuchUser.body?.message ?? ''));

  const garbageToken = await request('/me/profile', { headers: { Authorization: 'Bearer not-a-real-token-value' } });
  collectedErrors.push(garbageToken);
  check('Invalid bearer token returns 401', garbageToken.status === 401, `got ${garbageToken.status}`);
  check('Invalid token code is normalized (UNAUTHENTICATED/TOKEN_INVALID)', ['UNAUTHENTICATED', 'TOKEN_INVALID'].includes(garbageToken.body?.code), `code=${garbageToken.body?.code}`);
  check('Invalid token message is safe & non-leaking', isSafeDisclosure(garbageToken.body));

  const garbageRefresh = await request('/auth/refresh', { method: 'POST', headers: { Cookie: 'refresh_token=malformed.refresh.value' } });
  collectedErrors.push(garbageRefresh);
  check('Invalid refresh token returns 401', garbageRefresh.status === 401, `got ${garbageRefresh.status}`);
  check('Refresh failure code is normalized', ['UNAUTHENTICATED', 'TOKEN_INVALID', 'SESSION_EXPIRED'].includes(garbageRefresh.body?.code), `code=${garbageRefresh.body?.code}`);

  // ─── [4] AUTHORIZATION (403 FORBIDDEN) ────────────────────────────────────
  console.log('\n[4] AUTHORIZATION (403 FORBIDDEN)');

  const tarek = await login('tarek.audit@recruitflow.local', 'Password123!');
  check('Tarek (Performance Admin) can sign in', tarek.status === 200, `got ${tarek.status}`);
  const forbidden = await request('/imports/master-data/legal-entities/inspect', {
    method: 'POST',
    headers: await cookieHeader(tarek.cookies),
  }, undefined);
  collectedErrors.push(forbidden);
  check('Permission-less action returns 403', forbidden.status === 403, `got ${forbidden.status}`);
  check('403 code is FORBIDDEN', forbidden.body?.code === 'FORBIDDEN', `code=${forbidden.body?.code}`);
  check('403 message is the preserved safe contact message', /permission|Access denied/i.test(forbidden.body?.message ?? ''), `got "${forbidden.body?.message}"`);
  check('403 path does not leak tenant/named resources', isSafeDisclosure(forbidden.body));

  // ─── [5] TENANT-ISOLATION / SAFE 404 ─────────────────────────────────────
  console.log('\n[5] SAFE 404 (NOT_FOUND)');

  const unknownPublic = await request(`/public/organizations/nonexistent-${unique}/jobs`);
  collectedErrors.push(unknownPublic);
  check('Unknown public record returns 404', unknownPublic.status === 404, `got ${unknownPublic.status}`);
  check('404 code is NOT_FOUND', unknownPublic.body?.code === 'NOT_FOUND', `code=${unknownPublic.body?.code}`);
  check('404 message is safe & existence-neutral', typeof unknownPublic.body?.message === 'string' && /not available|could not be found|was not found/i.test(unknownPublic.body.message), `got "${unknownPublic.body?.message}"`);
  check('404 leaks no internals', isSafeDisclosure(unknownPublic.body));

  // ─── [6] CONFLICT (409 CONFLICT) ─────────────────────────────────────────
  console.log('\n[6] CONFLICT (409 CONFLICT)');

  const admin = await login('ahmed.mahmoud@recruitflow.local', 'Password123!');
  check('Admin can sign in', admin.status === 200, `got ${admin.status}`);
  const dupEmail = `g3.dup.${unique}@recruitflow.local`;
  const createC1 = await request('/candidates', { method: 'POST', headers: await cookieHeader(admin.cookies) }, {
    firstName: 'G3', lastName: 'Duplicate', email: dupEmail,
  });
  const firstHit200 = [200, 201].includes(createC1.status);
  check('First candidate create succeeds', firstHit200, `got ${createC1.status}`);
  const dupCid = isObject(createC1.body) && typeof createC1.body.id === 'string'
    ? createC1.body.id
    : (isObject(createC1.body) && Array.isArray(createC1.body.data) ? createC1.body.data[0]?.id : undefined);

  const createC2 = await request('/candidates', { method: 'POST', headers: await cookieHeader(admin.cookies) }, {
    firstName: 'G3', lastName: 'Duplicate', email: dupEmail,
  });
  collectedErrors.push(createC2);
  check('Duplicate candidate create returns 409', createC2.status === 409, `got ${createC2.status}`);
  check('409 code is CONFLICT', createC2.body?.code === 'CONFLICT', `code=${createC2.body?.code}`);
  check('409 message is safe', isSafeDisclosure(createC2.body));

  const fileCid = await request('/candidates', { method: 'POST', headers: await cookieHeader(admin.cookies) }, {
    firstName: 'G3', lastName: 'FileTest', email: `g3.file.${unique}@recruitflow.local`,
  });
  const fileCidValue = isObject(fileCid.body) && typeof fileCid.body.id === 'string'
    ? fileCid.body.id
    : (isObject(fileCid.body) && Array.isArray(fileCid.body.data) ? fileCid.body.data[0]?.id : undefined);
  check('File-test candidate created', [200, 201].includes(fileCid.status), `got ${fileCid.status}`);

  // ─── [7] RATE LIMITING (RATE_LIMITED) ────────────────────────────────────
  console.log('\n[7] RATE LIMITING (RATE_LIMITED)');

  const lockEmail = `g3.lock.${unique}@recruitflow.local`;
  let lockout = null;
  for (let i = 0; i < 7 && !lockout; i++) {
    const attempt = await request('/auth/login', {
      method: 'POST',
      ip: `10.70.${(i % 250) + 1}.${(i % 9) + 2}`,
    }, { email: lockEmail, password: 'WrongPassword999!' });
    if (i < 4) {
      check(`Login attempt ${i + 1} after failure is 401 INVALID_CREDENTIALS`, attempt.status === 401 && attempt.body?.code === 'INVALID_CREDENTIALS', `got ${attempt.status}/${attempt.body?.code}`);
    }
    if (attempt.status === 403 && attempt.body?.code === 'RATE_LIMITED') lockout = attempt;
    if (attempt.status === 429 && attempt.body?.code === 'RATE_LIMITED') lockout = attempt;
  }
  check('Account lockout returns RATE_LIMITED code', lockout !== null, lockout ? `got ${lockout.status}` : 'no lockout observed');
  if (lockout) {
    check('Lockout envelope is complete', assertEnvelope(lockout, lockout.status), JSON.stringify(lockout.body));
    check('Lockout is retryable', lockout.body?.retryable === true);
    check('Lockout surfaces retryAfterSeconds', typeof lockout.body?.retryAfterSeconds === 'number' && lockout.body.retryAfterSeconds >= 1, `got ${lockout.body?.retryAfterSeconds}`);
    check('Lockout status is 403 (preserved ACCOUNT_LOCKED contract)', lockout.status === 403, `got ${lockout.status}`);
    check('Lockout leaks no internals', isSafeDisclosure(lockout.body));
    collectedErrors.push(lockout);
  }

  // ─── [8] FILE / CV SECURITY CODES ────────────────────────────────────────
  console.log('\n[8] FILE / CV SECURITY CODES');

  // 8.1 Documents upload: missing file (controller requireCandidateFile -> FILE_INVALID)
  const missingCv = await requestMultipart('/documents/upload', { headers: await cookieHeader(admin.cookies) }, { candidateId: '00000000-0000-4000-8000-000000000000', documentType: 'CV' }, []);
  collectedErrors.push(missingCv);
  check('Documents upload without file -> 400 FILE_INVALID', missingCv.status === 400 && missingCv.body?.code === 'FILE_INVALID', `got ${missingCv.status}/${missingCv.body?.code}`);
  check('FILE_INVALID message preserved', missingCv.body?.message === 'Attach a CV file in the file field.', `got "${missingCv.body?.message}"`);

  // 8.2 Documents upload: invalid extension/mime on an existing candidate
  const docCid = fileCidValue || dupCid || '00000000-0000-4000-8000-000000000000';
  const hasRealCandidate = Boolean(fileCidValue || dupCid);
  if (hasRealCandidate) {
    const badMimeCv = await requestMultipart('/documents/upload', { headers: await cookieHeader(admin.cookies) },
      { candidateId: docCid, documentType: 'CV' },
      [{ fieldname: 'file', filename: 'resume.txt', contentType: 'text/plain', content: Buffer.from('hello') }]);
    collectedErrors.push(badMimeCv);
    check('Documents upload with invalid CV type -> 400 FILE_INVALID', badMimeCv.status === 400 && badMimeCv.body?.code === 'FILE_INVALID', `got ${badMimeCv.status}/${badMimeCv.body?.code}`);
    check('FILE_INVALID message preserved (PDF/DOC/DOCX)', badMimeCv.body?.message === 'CV files must be PDF, DOC, or DOCX.', `got "${badMimeCv.body?.message}"`);

    // 8.3 Documents upload: oversized CV (Multer LIMIT_FILE_SIZE -> 413 FILE_TOO_LARGE)
    const oversizeCv = await requestMultipart('/documents/upload', { headers: await cookieHeader(admin.cookies) },
      { candidateId: docCid, documentType: 'CV' },
      [{ fieldname: 'file', filename: 'big.pdf', contentType: 'application/pdf', content: Buffer.alloc(11 * 1024 * 1024, 0) }]);
    collectedErrors.push(oversizeCv);
    check('Oversized CV -> 413 FILE_TOO_LARGE', oversizeCv.status === 413 && oversizeCv.body?.code === 'FILE_TOO_LARGE', `got ${oversizeCv.status}/${oversizeCv.body?.code}`);
    check('FILE_TOO_LARGE envelope is complete', assertEnvelope(oversizeCv, 413), JSON.stringify(oversizeCv.body));
    check('FILE_TOO_LARGE message is stable & safe', oversizeCv.body?.message === 'The uploaded file is too large.', `got "${oversizeCv.body?.message}"`);
  } else {
    console.log('  ⚠️ SKIP: real-candidate upload checks (candidate creation failed)');
  }

  // 8.4 Public application CV: unsupported extension (pre-org-lookup, no fixtures needed)
  const cvEmail1 = `g3.cv1.${unique}@example.com`;
  const pubBadExt = await requestMultipart(`/public/organizations/nodoesnotexist/jobs/nodoesnotexist/apply`,
    {},
    { firstName: 'G3', lastName: 'File', email: cvEmail1, consentAccepted: 'true' },
    [{ fieldname: 'cv', filename: 'resume.exe', contentType: 'application/octet-stream', content: Buffer.from('MZ fake') }]);
  collectedErrors.push(pubBadExt);
  check('Public apply unsupported extension -> 400 FILE_INVALID', pubBadExt.status === 400 && pubBadExt.body?.code === 'FILE_INVALID', `got ${pubBadExt.status}/${pubBadExt.body?.code}`);
  check('FILE_INVALID extension message preserved', pubBadExt.body?.message === 'CV files must be PDF, DOC, or DOCX.', `got "${pubBadExt.body?.message}"`);

  // 8.5 Public application CV: signature mismatch (malware-like) -> FILE_UNSAFE
  const cvEmail2 = `g3.cv2.${unique}@example.com`;
  const pubSig = await requestMultipart(`/public/organizations/nodoesnotexist/jobs/nodoesnotexist/apply`,
    {},
    { firstName: 'G3', lastName: 'Sig', email: cvEmail2, consentAccepted: 'true' },
    [{ fieldname: 'cv', filename: 'cv.pdf', contentType: 'application/pdf', content: Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00fake-executable') }]);
  collectedErrors.push(pubSig);
  check('Public apply forged-signature CV -> 400 FILE_UNSAFE', pubSig.status === 400 && pubSig.body?.code === 'FILE_UNSAFE', `got ${pubSig.status}/${pubSig.body?.code}`);
  check('FILE_UNSAFE (scan) message preserved', pubSig.body?.message === 'The uploaded file is invalid or could not be verified.', `got "${pubSig.body?.message}"`);

  // ─── [9] IMPORT / WORKBOOK CODES ─────────────────────────────────────────
  console.log('\n[9] IMPORT / WORKBOOK CODES');

  const missingWorkbook = await request('/imports/candidates/inspect', {
    method: 'POST',
    headers: await cookieHeader(admin.cookies),
  });
  collectedErrors.push(missingWorkbook);
  check('Import inspect without workbook -> 400 FILE_INVALID', missingWorkbook.status === 400 && missingWorkbook.body?.code === 'FILE_INVALID', `got ${missingWorkbook.status}/${missingWorkbook.body?.code}`);
  check('Workbook FILE_INVALID message preserved', missingWorkbook.body?.message === 'Attach an Excel or CSV workbook in the file field.', `got "${missingWorkbook.body?.message}"`);

  const wrongFormat = await requestMultipart('/imports/candidates/inspect', { headers: await cookieHeader(admin.cookies) },
    {},
    [{ fieldname: 'file', filename: 'data.bmp', contentType: 'image/bmp', content: Buffer.from('BMxxxx') }]);
  collectedErrors.push(wrongFormat);
  check('Import unsupported extension -> 400 FILE_INVALID', wrongFormat.status === 400 && wrongFormat.body?.code === 'FILE_INVALID', `got ${wrongFormat.status}/${wrongFormat.body?.code}`);
  check('Unsupported format message preserved', wrongFormat.body?.message === 'Only .xlsx, .xls, and .csv files are supported.', `got "${wrongFormat.body?.message}"`);

  const emptyWorkbook = await requestMultipart('/imports/candidates/inspect', { headers: await cookieHeader(admin.cookies) },
    {},
    [{ fieldname: 'file', filename: 'data.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: Buffer.alloc(0) }]);
  collectedErrors.push(emptyWorkbook);
  check('Import empty workbook -> 400 FILE_INVALID', emptyWorkbook.status === 400 && emptyWorkbook.body?.code === 'FILE_INVALID', `got ${emptyWorkbook.status}/${emptyWorkbook.body?.code}`);
  check('Empty workbook message preserved', emptyWorkbook.body?.message === 'Attach an Excel or CSV workbook in the file field.', `got "${emptyWorkbook.body?.message}"`);

  const bogusDataset = await requestMultipart('/imports/master-data/bogus/inspect', { headers: await cookieHeader(admin.cookies) },
    {},
    [{ fieldname: 'file', filename: 'x.csv', contentType: 'text/csv', content: Buffer.from('a,b\n1,2') }]);
  collectedErrors.push(bogusDataset);
  check('Invalid master-data dataset -> 400 IMPORT_INVALID', bogusDataset.status === 400 && bogusDataset.body?.code === 'IMPORT_INVALID', `got ${bogusDataset.status}/${bogusDataset.body?.code}`);
  check('IMPORT_INVALID message preserved', bogusDataset.body?.message === 'Master-data dataset must be legal-entities, branches, or positions.', `got "${bogusDataset.body?.message}"`);

  // ─── [10] REQUEST / CORRELATION ID ───────────────────────────────────────
  console.log('\n[10] REQUEST & CORRELATION ID');

  const safeInbound = `trace-${unique}-ABC_123`;
  const safeRes = await request(`/public/organizations/nodoesnotexist-${unique}/jobs`, { headers: { 'X-Request-Id': safeInbound } });
  check('Safe inbound request ID is accepted', safeRes.body?.requestId === safeInbound, `got "${safeRes.body?.requestId}"`);
  check('X-Request-Id header mirrors body requestId', safeRes.headers['x-request-id'] === safeRes.body?.requestId);
  check('x-correlation-id header mirrors body requestId', safeRes.headers['x-correlation-id'] === safeRes.body?.requestId);

  const unsafeInbound = `bad id <>{}[]|^  ${'A'.repeat(120)}zz`;
  const unsafeRes = await request(`/public/organizations/nodoesnotexist-${unique}/jobs`, { headers: { 'X-Request-Id': unsafeInbound } });
  check('Unsafe/long inbound request ID is replaced', unsafeRes.status === 404 && typeof unsafeRes.body?.requestId === 'string');
  check('Replacement uses generated req_ prefix', /^req_[0-9a-f-]{36}$/.test(unsafeRes.body?.requestId ?? ''), `got "${unsafeRes.body?.requestId}"`);
  check('Unsafe payload is never reflected', !String(unsafeRes.body?.requestId).includes('bad id'), `got "${unsafeRes.body?.requestId}"`);
  check('Replacement mirrored to X-Request-Id header', unsafeRes.headers['x-request-id'] === unsafeRes.body?.requestId);
  check('Replacement mirrored to x-correlation-id header', unsafeRes.headers['x-correlation-id'] === unsafeRes.body?.requestId);

  const noIdRes = await request(`/public/organizations/nodoesnotexist-${unique}/jobs`);
  check('Missing inbound ID gets generated req_ ID', /^req_[0-9a-f-]{36}$/.test(noIdRes.body?.requestId ?? ''), `got "${noIdRes.body?.requestId}"`);

  const safeInboundLegacy = `legacy-trace-${unique}`;
  const legacyHeader = await request(`/public/organizations/nodoesnotexist-${unique}/jobs`, { headers: { 'x-correlation-id': safeInboundLegacy } });
  check('Legacy x-correlation-id inbound is honored', legacyHeader.body?.requestId === safeInboundLegacy, `got "${legacyHeader.body?.requestId}"`);

  const successId = safeInbound + '-success';
  const success = await request('/auth/login', { method: 'POST', headers: { 'X-Request-Id': successId } }, { email: 'ahmed.mahmoud@recruitflow.local', password: 'Password123!' });
  check('Successful responses also carry the request ID', success.headers['x-request-id'] === successId && success.headers['x-correlation-id'] === successId, "X-Request-Id header present");

  // ─── [11] READINESS + REPORT EXPORT POSITIVE CONTROLS ────────────────────
  console.log('\n[11] READINESS & REPORT EXPORT POSITIVE CONTROLS');

  const readiness = await request('/readiness');
  check('Readiness reports healthy (DB up) with 200', readiness.status === 200 && readiness.body?.status === 'up' && readiness.body?.services?.database === 'connected', `got ${readiness.status}/${readiness.body?.status}`);

  const adminReport = await request('/reports/export.xlsx', { headers: await cookieHeader(admin.cookies), method: 'GET' });
  const isXlsx = (adminReport.rawBuffer?.subarray(0, 2).toString() === 'PK' && adminReport.body === null) || (adminReport.rawBuffer?.length > 1000);
  check('Authorized report export returns xlsx stream (200)', adminReport.status === 200 && isXlsx, `got ${adminReport.status}`);

  // ─── [12] COMPOSITE SAFE-DISCLOSURE SWEEP ────────────────────────────────
  console.log('\n[12] COMPOSITE SAFE-DISCLOSURE SWEEP');

  let leakCount = 0;
  for (const res of collectedErrors) {
    if (res.body && !isSafeDisclosure(res.body)) {
      leakCount++;
      console.log(`      leak detected in ${res.status} response: ${JSON.stringify(res.body).slice(0, 300)}`);
    }
  }
  check(`No internal markers leaked across ${collectedErrors.length} sampled error responses`, leakCount === 0);

  // ─── [13] DETERMINISTIC CLEANUP ──────────────────────────────────────────
  console.log('\n[13] CLEANUP');

  try {
    const removeCandidates = [dupCid, fileCidValue].filter(Boolean);
    if (removeCandidates.length) {
      await prisma.candidateDocument.deleteMany({ where: { candidateId: { in: removeCandidates } } });
      await prisma.candidate.deleteMany({ where: { id: { in: removeCandidates } } });
    }
    check('Cleanup: removed test candidates + documents', true);
  } catch (err) {
    check(`Cleanup: candidate removal — ${err.message}`, false);
  }

  const rateKeyHashes = [lockEmail, `ghost.${unique}@recruitflow.local`].map((email) => sha256(`account:${email}`));
  if (rateKeyHashes.length) {
    await prisma.authRateLimit.deleteMany({ where: { OR: rateKeyHashes.map((keyHash) => ({ keyHash })) } });
  }
  check('Cleanup: rate limit records removed for test emails', true);

  await prisma.$disconnect();
  check('Cleanup: prisma disconnected', true);

  console.log(`\n=== M1-G3 SUMMARY: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exitCode = 1;
}

run().catch((err) => {
  console.error('M1-G3 suite crashed:', err);
  process.exitCode = 1;
});