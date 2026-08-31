/**
 * P2 — Public candidate acquisition verification suite.
 *
 * Requires: API running on P2_API_PORT (default 3000), DATABASE_URL set.
 * Uses unique test emails and removes only the records created by this run.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

loadEnv(path.join(__dirname, '..', '.env'));

const API_PORT = Number(process.env.P2_API_PORT || 3000);
const TEST_IP = '198.51.100.42';
const { PrismaClient } = require('./generated/client');
const prisma = new PrismaClient();

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function request(method, requestPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const request = http.request({
      hostname: '127.0.0.1',
      port: API_PORT,
      path: requestPath,
      method,
      headers: {
        Accept: 'application/json',
        'X-Forwarded-For': TEST_IP,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (response) => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch { parsed = data; }
        resolve({ status: response.statusCode, body: parsed });
      });
    });
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function hasPrivateKey(value) {
  const privateKeys = new Set(['id', 'organizationId', 'candidateId', 'vacancyId', 'email', 'phone', 'recruiter', 'candidate']);
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasPrivateKey);
  return Object.entries(value).some(([key, nested]) => privateKeys.has(key) || hasPrivateKey(nested));
}

function rateLimitHash(scope, value) {
  return crypto.createHash('sha256').update(`${scope}:${value}`).digest('hex');
}

async function cleanup({ organizationId, emails, applicationIds, candidateIds, vacancyRestore }) {
  const applications = applicationIds.length
    ? await prisma.application.findMany({ where: { id: { in: applicationIds } }, select: { id: true, candidateId: true } })
    : [];
  const allApplicationIds = [...new Set([...applicationIds, ...applications.map((item) => item.id)])];
  const allCandidateIds = [...new Set([...candidateIds, ...applications.map((item) => item.candidateId)])];

  if (allApplicationIds.length) {
    await prisma.applicationStatusHistory.deleteMany({ where: { applicationId: { in: allApplicationIds } } });
    await prisma.auditLog.deleteMany({ where: { action: 'PUBLIC_APPLICATION_CREATE', entityType: 'Application', entityId: { in: allApplicationIds } } });
    await prisma.application.deleteMany({ where: { id: { in: allApplicationIds } } });
  }
  if (allCandidateIds.length) {
    await prisma.candidate.deleteMany({ where: { id: { in: allCandidateIds, }, organizationId } });
  }
  await prisma.authRateLimit.deleteMany({
    where: {
      OR: [
        { scope: 'ip', keyHash: rateLimitHash('ip', TEST_IP) },
        ...emails.map((email) => ({ scope: 'account', keyHash: rateLimitHash('account', email) })),
      ],
    },
  });
  if (vacancyRestore) {
    await prisma.vacancy.update({ where: { id: vacancyRestore.id }, data: { status: vacancyRestore.status, openedAt: vacancyRestore.openedAt } });
  }
}

async function run() {
  console.log('=== P2 PUBLIC CANDIDATE ACQUISITION VERIFICATION ===\n');
  const stamp = `${Date.now()}-${process.pid}`;
  const emails = [`p2-public-${stamp}@example.test`, `p2-concurrent-${stamp}@example.test`];
  const applicationIds = [];
  const candidateIds = [];
  let vacancyRestore = null;
  let organization;
  let vacancy;

  try {
    organization = await prisma.organization.findFirst({
      where: { status: 'Active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, code: true, name: true },
    });
    check('An active organization is available', !!organization);
    if (!organization) return;

    vacancy = await prisma.vacancy.findFirst({
      where: { organizationId: organization.id, status: 'Open', openedAt: { not: null, lte: new Date() } },
      orderBy: { openedAt: 'desc' },
      select: { id: true, vacancyCode: true, status: true, openedAt: true },
    });
    if (!vacancy) {
      vacancy = await prisma.vacancy.findFirst({
        where: { organizationId: organization.id },
        orderBy: { createdAt: 'asc' },
        select: { id: true, vacancyCode: true, status: true, openedAt: true },
      });
      if (vacancy) {
        vacancyRestore = { id: vacancy.id, status: vacancy.status, openedAt: vacancy.openedAt };
        await prisma.vacancy.update({ where: { id: vacancy.id }, data: { status: 'Open', openedAt: new Date() } });
      }
    }
    check('A vacancy is available for public acquisition', !!vacancy);
    if (!vacancy) return;

    const basePath = `/api/v1/public/organizations/${encodeURIComponent(organization.code)}/jobs`;
    const detailPath = `${basePath}/${encodeURIComponent(vacancy.vacancyCode)}`;
    const applyPath = `${detailPath}/apply`;

    const listing = await request('GET', basePath);
    check('Anonymous job listing is available', listing.status === 200, `status ${listing.status}`);
    check('Listing is tenant-scoped', listing.body?.organization?.code === organization.code && Array.isArray(listing.body?.data), 'response shape');
    const listedJob = listing.body?.data?.find((job) => job.vacancyCode === vacancy.vacancyCode);
    check('Listing omits internal identifiers and candidate data', !!listedJob && !hasPrivateKey(listedJob));
    check('Listing exposes separate detail and apply paths', listedJob?.detailPath?.endsWith(`/jobs/${vacancy.vacancyCode}`) && listedJob?.applyPath?.endsWith(`/jobs/${vacancy.vacancyCode}/apply`));

    const detail = await request('GET', detailPath);
    check('Anonymous job detail is available', detail.status === 200, `status ${detail.status}`);
    check('Detail remains sanitized', !!detail.body && detail.body.vacancyCode === vacancy.vacancyCode && !hasPrivateKey(detail.body));
    const unknown = await request('GET', `${basePath}/DOES-NOT-EXIST`);
    check('Unknown vacancy is hidden behind a public 404', unknown.status === 404, `status ${unknown.status}`);

    const invalidConsent = await request('POST', applyPath, {
      firstName: 'Consent', lastName: 'Required', email: emails[0], consentAccepted: false,
    });
    check('Consent is mandatory', invalidConsent.status === 400, `status ${invalidConsent.status}`);

    const accepted = await request('POST', applyPath, {
      firstName: 'Public', lastName: 'Applicant', email: emails[0],
      currentTitle: 'Software Engineer', skills: ['TypeScript', 'Recruiting workflows'],
      source: 'LinkedIn', consentAccepted: true,
    });
    check('Valid public application is accepted', accepted.status === 201 && accepted.body?.accepted === true, `status ${accepted.status}`);
    check('Application returns a reference', typeof accepted.body?.applicationCode === 'string' && accepted.body?.vacancyCode === vacancy.vacancyCode);

    const candidate = await prisma.candidate.findUnique({ where: { organizationId_email: { organizationId: organization.id, email: emails[0] } } });
    check('Candidate is created in the correct tenant', !!candidate && candidate.organizationId === organization.id);
    if (candidate) candidateIds.push(candidate.id);
    const application = candidate
      ? await prisma.application.findUnique({ where: { vacancyId_candidateId: { vacancyId: vacancy.id, candidateId: candidate.id } } })
      : null;
    if (application) applicationIds.push(application.id);
    check('Candidate consent is persisted with attribution', candidate?.consentStatus === 'Active' && candidate?.consentSource === 'linkedin' && !!candidate?.consentCapturedAt);
    check('Application is attributed and starts in Applied', application?.source === 'linkedin' && application?.stage === 'Applied');
    const history = application ? await prisma.applicationStatusHistory.count({ where: { applicationId: application.id, toStage: 'Applied', reason: 'Public application submitted' } }) : 0;
    const audit = application ? await prisma.auditLog.findFirst({ where: { action: 'PUBLIC_APPLICATION_CREATE', entityType: 'Application', entityId: application.id, result: 'SUCCESS' } }) : null;
    check('Application history and audit evidence are written', history === 1 && !!audit);

    const duplicate = await request('POST', applyPath, {
      firstName: 'Public', lastName: 'Applicant', email: emails[0], source: 'linkedin', consentAccepted: true,
    });
    check('Duplicate application is rejected', duplicate.status === 409, `status ${duplicate.status}`);

    const concurrentBody = {
      firstName: 'Concurrent', lastName: 'Applicant', email: emails[1], source: 'career-site', consentAccepted: true,
    };
    const concurrent = await Promise.all([
      request('POST', applyPath, concurrentBody),
      request('POST', applyPath, concurrentBody),
    ]);
    const concurrentStatuses = concurrent.map((response) => response.status).sort((a, b) => a - b);
    check('Concurrent duplicate submissions resolve deterministically', concurrentStatuses[0] === 201 && concurrentStatuses[1] === 409, `statuses ${concurrentStatuses.join(', ')}`);
    const concurrentCandidate = await prisma.candidate.findUnique({ where: { organizationId_email: { organizationId: organization.id, email: emails[1] } } });
    if (concurrentCandidate) candidateIds.push(concurrentCandidate.id);
    const concurrentApplication = concurrentCandidate
      ? await prisma.application.findUnique({ where: { vacancyId_candidateId: { vacancyId: vacancy.id, candidateId: concurrentCandidate.id } } })
      : null;
    if (concurrentApplication) applicationIds.push(concurrentApplication.id);
    check('Concurrent winner is represented once', !!concurrentCandidate && !!concurrentApplication);
  } finally {
    if (organization) await cleanup({ organizationId: organization.id, emails, applicationIds, candidateIds, vacancyRestore });
  }

  console.log(`\nP2 public acquisition checks: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
