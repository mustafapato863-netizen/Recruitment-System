const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/Recruitment_DB?schema=public';
}
const { PrismaClient } = require('../generated/client');
const p = new PrismaClient();

async function check() {
  const [users, candidates, applications, vacancies, requests, offers] = await Promise.all([
    p.user.count(),
    p.candidate.count(),
    p.application.count(),
    p.vacancy.count(),
    p.vacancyRequest.count(),
    p.offer.count(),
  ]);
  const admin = await p.user.findFirst({
    select: {
      email: true,
      status: true,
      userRoles: { select: { role: { select: { code: true, name: true } } } },
    },
  });
  console.log('--- DATABASE STATE VERIFICATION ---');
  console.log('Users Count:', users);
  console.log('Admin User:', admin?.email, '| Status:', admin?.status, '| Role:', admin?.userRoles[0]?.role?.name);
  console.log('Candidates Count:', candidates);
  console.log('Applications Count:', applications);
  console.log('Vacancies Count:', vacancies);
  console.log('Vacancy Requests Count:', requests);
  console.log('Offers Count:', offers);
  await p.$disconnect();
}
check();
