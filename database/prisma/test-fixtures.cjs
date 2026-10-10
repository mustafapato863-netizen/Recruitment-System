// Test fixtures for development/testing with simplified data.
// Three role types (Employee/Requester, Manager/Hiring Manager,
// Administrator/Recruitment Ops), placeholder people and one job/application.
//
// Ids are fixed UUIDs (every id column is @db.Uuid, so the old 4-character ids
// can no longer be stored); the short fixture number is the last 4 digits.
// Idempotent: every row is upserted on its unique key, so re-running is safe.

const TEST_PASSWORD_HASH = '$2b$10$TEST.HASH.FOR.DEV.ONLY.123'; // not a usable bcrypt hash; dev only
const DAY_MS = 24 * 60 * 60 * 1000;

function fixtureId(number) {
  return `7e570000-0000-4000-8000-${String(number).padStart(12, '0')}`;
}

function dateFromNow(days) {
  return new Date(Date.now() + days * DAY_MS);
}

async function upsertRole(tx, code, name) {
  return tx.role.upsert({ where: { code }, update: {}, create: { code, name } });
}

async function upsertUser(tx, orgId, id, email, displayName) {
  const emailNormalized = email.toLowerCase();
  const existing = await tx.user.findUnique({
    where: { organizationId_emailNormalized: { organizationId: orgId, emailNormalized } },
  });
  const data = { email, emailNormalized, displayName, passwordHash: TEST_PASSWORD_HASH, status: 'Active' };
  if (existing) return tx.user.update({ where: { id: existing.id }, data });
  return tx.user.create({ data: { id, organizationId: orgId, ...data } });
}

async function upsertUserRole(tx, userId, roleId) {
  await tx.userRole.upsert({ where: { userId_roleId: { userId, roleId } }, update: {}, create: { userId, roleId } });
}

async function seedTestFixtures(tx, { organization }) {
  const orgId = organization.id;
  const branch = await tx.branch.findFirst({ where: { organizationId: orgId }, orderBy: { createdAt: 'asc' } });
  const position = await tx.position.findFirst({ where: { organizationId: orgId }, orderBy: { createdAt: 'asc' } });
  if (!branch || !position) {
    throw new Error('No branch/position in this organization. Run the base seed first (pnpm --dir database prisma:seed).');
  }

  const employeeRole = await upsertRole(tx, 'EMPLOYEE', 'Employee/Requester');
  const managerRole = await upsertRole(tx, 'MANAGER', 'Manager/Hiring Manager');
  const adminRole = await upsertRole(tx, 'ADMIN', 'Administrator/Recruitment Ops');

  const empUser = await upsertUser(tx, orgId, fixtureId(10), 'e@test.com', 'E Mployee');
  await upsertUserRole(tx, empUser.id, employeeRole.id);
  const mgrUser = await upsertUser(tx, orgId, fixtureId(20), 'm@test.com', 'M Anager');
  await upsertUserRole(tx, mgrUser.id, managerRole.id);
  const adminUser = await upsertUser(tx, orgId, fixtureId(30), 'a@test.com', 'A Dmin');
  await upsertUserRole(tx, adminUser.id, adminRole.id);

  const request = await tx.vacancyRequest.upsert({
    where: { requestCode: 'VR-TEST' },
    update: {},
    create: {
      id: fixtureId(40),
      organizationId: orgId,
      branchId: branch.id,
      positionId: position.id,
      requestCode: 'VR-TEST',
      requesterId: empUser.id,
      status: 'Approved',
      requestedHeadcount: 1,
      employmentType: 'Full-time',
      reason: 'Test vacancy request',
      budgetStatus: 'Budgeted',
      criticality: 'Normal',
      targetStartDate: dateFromNow(30),
      justification: 'Test fixture for development',
      submittedAt: new Date(),
    },
  });

  const vacancy = await tx.vacancy.upsert({
    where: { vacancyCode: 'VAC-TEST' },
    update: {},
    create: {
      id: fixtureId(50),
      organizationId: orgId,
      branchId: branch.id,
      positionId: position.id,
      vacancyRequestId: request.id,
      vacancyCode: 'VAC-TEST',
      status: 'Open',
      approvedHeadcount: 1,
      joinedHeadcount: 0,
      location: 'Test Location',
      openedAt: new Date(),
      targetStartDate: dateFromNow(30),
      requiredSkills: ['Test Skill'],
    },
  });

  const candidate = await tx.candidate.upsert({
    where: { candidateCode: 'CND-TEST' },
    update: {},
    create: { id: fixtureId(55), organizationId: orgId, candidateCode: 'CND-TEST', firstName: 'C', lastName: 'Andidate', email: 'c@test.com' },
  });

  await tx.application.upsert({
    where: { applicationCode: 'APP-TEST' },
    update: {},
    create: {
      id: fixtureId(60),
      organizationId: orgId,
      applicationCode: 'APP-TEST',
      vacancyId: vacancy.id,
      candidateId: candidate.id,
      stage: 'Applied',
      source: 'Test',
      appliedAt: new Date(),
      primaryRecruiterId: empUser.id,
      taskOwnerId: empUser.id,
    },
  });

  return { users: 3, vacancyRequests: 1, vacancies: 1, candidates: 1, applications: 1 };
}

module.exports = { seedTestFixtures, fixtureId };
