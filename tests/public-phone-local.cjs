// Local-only regression for phone-only public applications and normalized dedupe.
const assert = require('node:assert/strict');
const { PrismaClient } = require('../database/generated/client');
process.loadEnvFile('.env');

const prisma = new PrismaClient();
const base = process.env.RECRUITFLOW_API_URL || 'http://localhost:3000/api/v1';
let candidateId;
let applicationId;

async function main() {
  const vacancy = await prisma.vacancy.findFirst({
    where: { status: 'Open', openedAt: { not: null, lte: new Date() } },
    include: { organization: true },
  });
  assert.ok(vacancy, 'This regression requires an open vacancy');
  const phone = `+20 111 7${Date.now().toString().slice(-8)}`;
  const payload = {
    firstName: 'Phone',
    lastName: 'Only Regression',
    phone,
    consentAccepted: true,
    source: 'qa-phone',
  };
  const first = await fetch(`${base}/public/organizations/${vacancy.organization.code}/jobs/${vacancy.vacancyCode}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(first.status, 201, await first.clone().text());
  const accepted = await first.json();
  assert.equal(accepted.accepted, true);
  const row = await prisma.candidate.findFirstOrThrow({ where: { organizationId: vacancy.organizationId, phone: phone.replace(/\D/g, '') } });
  candidateId = row.id;
  assert.equal(row.email, null);
  applicationId = (await prisma.application.findUniqueOrThrow({ where: { vacancyId_candidateId: { vacancyId: vacancy.id, candidateId } } })).id;

  const second = await fetch(`${base}/public/organizations/${vacancy.organization.code}/jobs/${vacancy.vacancyCode}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, phone: phone.replace(/\D/g, '') }),
  });
  assert.equal(second.status, 409, await second.clone().text());
  console.log('PASS: phone-only public application, canonical phone storage, and formatted-phone dedupe');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (applicationId) {
    await prisma.auditLog.deleteMany({ where: { entityType: 'Application', entityId: applicationId } });
    await prisma.applicationStatusHistory.deleteMany({ where: { applicationId } });
    await prisma.application.delete({ where: { id: applicationId } });
  }
  if (candidateId) {
    await prisma.auditLog.deleteMany({ where: { entityType: 'Candidate', entityId: candidateId } });
    await prisma.candidate.delete({ where: { id: candidateId } });
  }
  await prisma.$disconnect();
});
