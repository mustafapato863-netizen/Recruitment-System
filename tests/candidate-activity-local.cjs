// Local-only integration/browser regression. Creates and removes one isolated candidate.
const { PrismaClient } = require('../database/generated/client');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
process.loadEnvFile('.env');
const prisma = new PrismaClient();
const base = process.env.RECRUITFLOW_API_URL || 'http://localhost:3000/api/v1';
let candidate;
async function main() {
  const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.RECRUITFLOW_TEST_EMAIL || 'admin@me.com', password: process.env.RECRUITFLOW_TEST_PASSWORD || 'Admin@123456' }) });
  assert.equal(login.status, 200);
  const { user } = await login.json();
  const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const createCandidate = await fetch(`${base}/candidates`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: 'Activity', lastName: 'Regression', phone: '+20 111 222 3333', source: 'QA' }) });
  assert.equal(createCandidate.status, 201, await createCandidate.clone().text());
  const createdCandidate = await createCandidate.json();
  assert.equal(createdCandidate.email, null);
  assert.equal(createdCandidate.phone, '201112223333');
  candidate = await prisma.candidate.findUniqueOrThrow({ where: { id: createdCandidate.id } });
  const path = `/candidates/${candidate.id}/activities`;
  async function request(url, body, expected = 200) {
    const response = await fetch(`${base}${url}`, { method: body ? 'POST' : 'GET', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal(response.status, expected, await response.clone().text());
    return response.json();
  }
  assert.equal((await request(path)).completed, 0);
  await request(path, { kind: 'Call', summary: 'Confirmed availability' }, 201);
  const followup = await request(path, { kind: 'Email', summary: 'Request documents', dueAt: new Date(Date.now() + 86400000).toISOString() }, 201);
  assert.equal((await request(path)).completed, 1);
  assert.equal((await request(path)).pending, 1);
  await request(`${path}/${followup.id}/complete`, {}, 201);
  await request(`${path}/${followup.id}/complete`, {}, 201);
  const result = await request(`${path}?pageSize=1`);
  assert.equal(result.completed, 2);
  assert.equal(result.completedByMe, 2);
  assert.equal(result.pending, 0);
  assert.equal(result.entries.length, 1);
  await request(path, { kind: 'Call', summary: '   ' }, 400);
  await request(path, { kind: 'Call', summary: 'Past due', dueAt: '2000-01-01T00:00:00Z' }, 400);
  await request(`/candidates/${randomUUID()}/activities`, undefined, 404);
  const vacancies = await prisma.vacancy.findMany({ where: { organizationId: user.organizationId }, take: 2 });
  assert.equal(vacancies.length, 2, 'This local regression requires two existing vacancies');
  for (const vacancy of vacancies) {
    const app = await prisma.application.create({ data: { organizationId: user.organizationId, candidateId: candidate.id, vacancyId: vacancy.id, applicationCode: `QA-${randomUUID()}`, primaryRecruiterId: user.id } });
    await prisma.applicationNote.create({ data: { organizationId: user.organizationId, applicationId: app.id, authorId: user.id, content: 'Isolated activity regression note' } });
  }
  const app = await prisma.application.findFirstOrThrow({ where: { candidateId: candidate.id } });
  await prisma.screeningLog.create({ data: { organizationId: user.organizationId, applicationId: app.id, screenerId: user.id, outcome: 'Passed' } });
  const combined = await request(path);
  assert.equal(combined.completed, 5);
  assert.equal(combined.byKind.Note, 2);
  assert.equal(combined.byKind.Screening, 1);
  const browser = spawnSync('python', ['tests/browser/candidate_activity.py', candidate.id], { stdio: 'inherit', env: process.env });
  assert.equal(browser.status, 0, 'Browser regression failed');
  assert.equal((await request(path)).completed, 7);
  console.log('PASS: persisted activity, pending/completed counts, idempotence, pagination, validation, browser and reload');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (candidate) {
    await prisma.task.deleteMany({ where: { organizationId: candidate.organizationId, entityType: 'Candidate', entityId: candidate.id } });
    await prisma.screeningLog.deleteMany({ where: { application: { candidateId: candidate.id } } });
    await prisma.applicationNote.deleteMany({ where: { application: { candidateId: candidate.id } } });
    await prisma.application.deleteMany({ where: { candidateId: candidate.id } });
    await prisma.candidate.delete({ where: { id: candidate.id } });
  }
  await prisma.$disconnect();
});
