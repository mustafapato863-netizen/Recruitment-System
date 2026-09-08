// Local-only regression for generated interview titles and attendee job-title snapshots.
const assert = require('node:assert/strict');
const { PrismaClient } = require('../database/generated/client');
process.loadEnvFile('.env');

const prisma = new PrismaClient();
const base = process.env.RECRUITFLOW_API_URL || 'http://localhost:3000/api/v1';
let interviewId;
let applicationId;
let interviewTitle;

async function main() {
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.RECRUITFLOW_TEST_EMAIL || 'admin@me.com', password: process.env.RECRUITFLOW_TEST_PASSWORD || 'Admin@123456' }),
  });
  assert.equal(login.status, 200, await login.clone().text());
  const cookie = login.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  const app = await prisma.application.findFirst({ where: { organizationId: (await login.clone().json()).user.organizationId }, include: { candidate: true, vacancy: { include: { position: true } } } });
  assert.ok(app, 'This regression requires an application');
  applicationId = app.id;
  const interviewer = await prisma.user.findFirst({ where: { organizationId: app.organizationId, status: 'Active' } });
  assert.ok(interviewer, 'This regression requires an active interviewer');
  const start = new Date(Date.now() + 3 * 86400000);
  const end = new Date(start.getTime() + 45 * 60000);
  const response = await fetch(`${base}/interviews`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ applicationId, interviewType: 'Technical', scheduledStart: start.toISOString(), scheduledEnd: end.toISOString(), attendeeUserIds: [interviewer.id], interviewerJobTitle: 'QA Interview Panelist' }),
  });
  assert.equal(response.status, 201, await response.clone().text());
  const interview = await response.json();
  interviewId = interview.id;
  interviewTitle = interview.title;
  assert.match(interview.title, /Technical Interview/);
  assert.equal(interview.attendees[0].jobTitle, 'QA Interview Panelist');
  console.log('PASS: generated interview title and attendee interviewer job-title snapshot');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (interviewId) {
    if (interviewTitle) await prisma.applicationNote.deleteMany({ where: { applicationId, content: { contains: interviewTitle } } });
    await prisma.interview.delete({ where: { id: interviewId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
});
