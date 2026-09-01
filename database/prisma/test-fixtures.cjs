// Test fixtures for development/testing with simplified data
// Following user constraints: IDs <= 4 chars, simple fname/lname placeholders, 3 role types

const TEST_PASSWORD_HASH = '$2b$10$TEST.HASH.FOR.DEV.ONLY.123'; // bcrypt hash of "test123"
const DAY_MS = 24 * 60 * 60 * 1000;

function fixtureId(number) {
  // Generate short ID: max 4 characters
  return String(number).padStart(4, '0');
}

function dateFromNow(days) {
  return new Date(Date.now() + days * DAY_MS);
}

async function upsertUser(tx, orgId, id, email, firstName, lastName, roleCode) {
  const existingById = await tx.user.findUnique({ where: { id } });
  if (existingById) {
    return tx.user.update({
      where: { id },
      data: {
        email,
        emailNormalized: email.toLowerCase(),
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        passwordHash: TEST_PASSWORD_HASH,
        status: 'Active'
      }
    });
  }

  const existingByEmail = await tx.user.findUnique({
    where: { organizationId_emailNormalized: { organizationId: orgId, emailNormalized: email.toLowerCase() } }
  });
  if (existingByEmail) {
    return tx.user.update({
      where: { id: existingByEmail.id },
      data: {
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        passwordHash: TEST_PASSWORD_HASH,
        status: 'Active'
      }
    });
  }

  return tx.user.create({
    data: {
      id,
      organizationId: orgId,
      email,
      emailNormalized: email.toLowerCase(),
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
      passwordHash: TEST_PASSWORD_HASH,
      status: 'Active'
    }
  });
}

async function upsertUserRole(tx, userId, roleId) {
  const existing = await tx.userRole.findUnique({ where: { userId_roleId: { userId, roleId } } });
  if (existing) return;

  return tx.userRole.create({
    data: { userId, roleId }
  });
}

async function seedTestFixtures(tx, { organization }) {
  const orgId = organization.id;

  // Get or create test roles
  const employeeRole = await tx.role.upsert({
    where: { code: 'EMPLOYEE' },
    update: {},
    create: {
      id: fixtureId(1),
      name: 'Employee/Requester',
      code: 'EMPLOYEE',
      description: 'Can request vacancies and view own applications'
    }
  });

  const managerRole = await tx.role.upsert({
    where: { code: 'MANAGER' },
    update: {},
    create: {
      id: fixtureId(2),
      name: 'Manager/Hiring Manager',
      code: 'MANAGER',
      description: 'Can approve requests and manage hiring process'
    }
  });

  const adminRole = await tx.role.upsert({
    where: { code: 'ADMIN' },
    update: {},
    create: {
      id: fixtureId(3),
      name: 'Administrator/Recruitment Ops',
      code: 'ADMIN',
      description: 'Full system access including user management'
    }
  });

  // Create test users with simple placeholder names (single letters)
  // Employee/Requester role
  const empUser = await upsertUser(tx, orgId, fixtureId(10), 'e@test.com', 'E', 'mployee', employeeRole.code);
  await upsertUserRole(tx, empUser.id, employeeRole.id);

  // Manager/Hiring Manager role
  const mgrUser = await upsertUser(tx, orgId, fixtureId(20), 'm@test.com', 'M', 'anager', managerRole.code);
  await upsertUserRole(tx, mgrUser.id, managerRole.id);

  // Administrator/Recruitment Operations role
  const adminUser = await upsertUser(tx, orgId, fixtureId(30), 'a@test.com', 'A', 'dmin', adminRole.code);
  await upsertUserRole(tx, adminUser.id, adminRole.id);

  // Create a simple test vacancy request
  await tx.vacancyRequest.create({
    data: {
      id: fixtureId(40),
      organizationId: orgId,
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
      submittedAt: new Date()
    }
  });

  // Create a simple test vacancy
  await tx.vacancy.create({
    data: {
      id: fixtureId(50),
      organizationId: orgId,
      vacancyCode: 'VAC-TEST',
      status: 'Open',
      approvedHeadcount: 1,
      joinedHeadcount: 0,
      location: 'Test Location',
      openedAt: new Date(),
      targetStartDate: dateFromNow(30),
      requiredSkills: ['Test Skill']
    }
  });

  // Create a simple test application
  await tx.application.create({
    data: {
      id: fixtureId(60),
      organizationId: orgId,
      applicationCode: 'APP-TEST',
      vacancyId: fixtureId(50),
      candidateId: fixtureId(50), // Reusing vacancy ID for simplicity in test
      stage: 'New',
      source: 'Test',
      appliedAt: new Date(),
      primaryRecruiterId: empUser.id,
      taskOwnerId: empUser.id
    }
  });

  return {
    users: 3,
    vacancyRequests: 1,
    vacancies: 1,
    applications: 1
  };
}

module.exports = { seedTestFixtures };