/**
 * P1 production boundary checks.
 *
 * The API is expected to persist a real recovery token and queue its email in
 * production without returning the raw token. This test does not deliver mail.
 * Run it against an isolated API process with NODE_ENV=production.
 */

const http = require('http');
const { PrismaClient } = require('./generated/client');

const API_PORT = Number(process.env.P1_API_PORT || 3000);
const prisma = new PrismaClient();

function request(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: API_PORT,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

async function main() {
  const organization = await prisma.organization.findFirst({ select: { id: true } });
  if (!organization) throw new Error('No organization is available for the production test');
  const email = `p1-production-${Date.now()}@recruitflow-test.local`;
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email,
      emailNormalized: email,
      displayName: 'P1 Production Queue Test',
      status: 'Active',
    },
  });
  let row;
  let token;
  try {
    const result = await request('/api/v1/auth/password-reset/request', { email });
    if (result.status !== 200 || result.body?.accepted !== true) {
      throw new Error(`Unexpected production response: ${result.status} ${JSON.stringify(result.body)}`);
    }
    if (result.body.devToken || result.body.delivery !== 'queued') {
      throw new Error(`Production response leaked or misclassified delivery: ${JSON.stringify(result.body)}`);
    }

    const unknown = await request('/api/v1/auth/password-reset/request', {
      email: `unknown-${Date.now()}@recruitflow-test.local`,
    });
    if (unknown.status !== 200 || JSON.stringify(Object.keys(unknown.body).sort()) !== JSON.stringify(Object.keys(result.body).sort())) {
      throw new Error(`Production anti-enumeration response shape changed: known=${JSON.stringify(result.body)} unknown=${JSON.stringify(unknown.body)}`);
    }

    row = await prisma.emailOutbox.findFirst({
      where: { toEmail: email, template: 'password_reset', status: 'Pending' },
      orderBy: { createdAt: 'desc' },
    });
    if (
      !row ||
      typeof row.payload?.encryptedToken !== 'string' ||
      typeof row.payload?.tokenIv !== 'string' ||
      typeof row.payload?.tokenAuthTag !== 'string' ||
      Object.prototype.hasOwnProperty.call(row.payload, 'token')
    ) {
      throw new Error('No encrypted pending production password-reset outbox row was found');
    }

    token = await prisma.authToken.findFirst({
      where: { userId: user.id, type: 'PasswordReset', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!token || token.type !== 'PasswordReset' || token.consumedAt) {
      throw new Error('Queued token was not persisted as an active hashed auth token');
    }
    console.log('P1 production queue checks: 4/4 PASS');
  } finally {
    if (row) await prisma.emailOutbox.deleteMany({ where: { id: row.id } });
    if (token) await prisma.authToken.deleteMany({ where: { id: token.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  }
}

main()
  .catch((error) => {
    console.error(`P1 production queue checks FAILED: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
