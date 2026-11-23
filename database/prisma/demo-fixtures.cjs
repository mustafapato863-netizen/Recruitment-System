const DEMO_PASSWORD_HASH = '$2b$10$dd0OAfjCvUL/waxTy79xZe0H7QN3r7oEbPPKJ9dwg97.y70rZgep6';
const DAY_MS = 24 * 60 * 60 * 1000;

function fixtureId(number) {
  return `20000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
}

function dateFromNow(days) {
  return new Date(Date.now() + days * DAY_MS);
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function upsertPosition(tx, orgId, id, code, title, description) {
  const existingById = await tx.position.findUnique({ where: { id } });
  if (existingById) {
    return tx.position.update({
      where: { id },
      data: { code, title, description, status: 'Active' },
    });
  }
  const existingByCode = await tx.position.findUnique({
    where: { organizationId_code: { organizationId: orgId, code } },
  });
  if (existingByCode) {
    return tx.position.update({
      where: { id: existingByCode.id },
      data: { title, description, status: 'Active' },
    });
  }
  return tx.position.create({
    data: { id, organizationId: orgId, code, title, description, status: 'Active' },
  });
}

async function upsertBranch(tx, orgId, id, code, name, city) {
  const country = 'UAE';
  const existingById = await tx.branch.findUnique({ where: { id } });
  if (existingById) {
    return tx.branch.update({
      where: { id },
      data: { code, name, city, country, status: 'Active' },
    });
  }
  const existingByCode = await tx.branch.findUnique({
    where: { organizationId_code: { organizationId: orgId, code } },
  });
  if (existingByCode) {
    return tx.branch.update({
      where: { id: existingByCode.id },
      data: { name, city, country, status: 'Active' },
    });
  }
  return tx.branch.create({
    data: { id, organizationId: orgId, code, name, city, country, status: 'Active' },
  });
}

async function upsertCandidate(tx, orgId, id, data) {
  const existingByEmail = await tx.candidate.findUnique({
    where: { organizationId_email: { organizationId: orgId, email: data.email } },
  });
  if (existingByEmail) {
    return tx.candidate.update({
      where: { id: existingByEmail.id },
      data: { ...data, status: 'Active' },
    });
  }
  const existingByCode = await tx.candidate.findUnique({
    where: { candidateCode: data.candidateCode },
  });
  if (existingByCode) {
    return tx.candidate.update({
      where: { id: existingByCode.id },
      data: { ...data, status: 'Active' },
    });
  }
  const existingById = await tx.candidate.findUnique({ where: { id } });
  if (existingById) {
    return tx.candidate.update({
      where: { id },
      data: { ...data, status: 'Active' },
    });
  }
  return tx.candidate.create({
    data: { id, organizationId: orgId, ...data, status: 'Active' },
  });
}

async function upsertVacancyRequest(tx, id, data) {
  const existingByCode = await tx.vacancyRequest.findFirst({
    where: { organizationId: data.organizationId, requestCode: data.requestCode },
  });
  if (existingByCode) {
    return tx.vacancyRequest.update({
      where: { id: existingByCode.id },
      data,
    });
  }
  const existingById = await tx.vacancyRequest.findUnique({ where: { id } });
  if (existingById) {
    return tx.vacancyRequest.update({
      where: { id },
      data,
    });
  }
  return tx.vacancyRequest.create({
    data: { id, ...data },
  });
}

async function upsertVacancy(tx, id, data) {
  const existingByCode = await tx.vacancy.findUnique({
    where: { vacancyCode: data.vacancyCode },
  });
  const existingByReq = await tx.vacancy.findUnique({
    where: { vacancyRequestId: data.vacancyRequestId },
  });
  // Older demo runs could associate a vacancy code with a different request.
  // Keep the existing coded record and its history instead of failing on the
  // one-to-one request constraint during an otherwise idempotent seed.
  if (existingByCode && existingByReq && existingByCode.id !== existingByReq.id) {
    return existingByCode;
  }
  if (existingByCode) {
    return tx.vacancy.update({
      where: { id: existingByCode.id },
      data,
    });
  }
  if (existingByReq) {
    return tx.vacancy.update({
      where: { id: existingByReq.id },
      data,
    });
  }
  const existingById = await tx.vacancy.findUnique({ where: { id } });
  if (existingById) {
    return tx.vacancy.update({
      where: { id },
      data,
    });
  }
  return tx.vacancy.create({
    data: { id, ...data },
  });
}

async function upsertApplication(tx, id, data) {
  const existingByCandVac = await tx.application.findUnique({
    where: { vacancyId_candidateId: { vacancyId: data.vacancyId, candidateId: data.candidateId } },
  });
  if (existingByCandVac) {
    return tx.application.update({
      where: { id: existingByCandVac.id },
      data,
    });
  }
  const existingByCode = await tx.application.findUnique({
    where: { applicationCode: data.applicationCode },
  });
  if (existingByCode) {
    return tx.application.update({
      where: { id: existingByCode.id },
      data,
    });
  }
  const existingById = await tx.application.findUnique({ where: { id } });
  if (existingById) {
    return tx.application.update({
      where: { id },
      data,
    });
  }
  return tx.application.create({
    data: { id, ...data },
  });
}

async function upsertInterview(tx, id, data) {
  const existingByCode = await tx.interview.findUnique({
    where: { interviewCode: data.interviewCode },
  });
  if (existingByCode) {
    return tx.interview.update({
      where: { id: existingByCode.id },
      data,
    });
  }
  const existingById = await tx.interview.findUnique({ where: { id } });
  if (existingById) {
    return tx.interview.update({
      where: { id },
      data,
    });
  }
  return tx.interview.create({
    data: { id, ...data },
  });
}

async function upsertOffer(tx, id, data) {
  const existingByCode = await tx.offer.findUnique({
    where: { offerCode: data.offerCode },
  });
  if (existingByCode) {
    return tx.offer.update({
      where: { id: existingByCode.id },
      data,
    });
  }
  const existingById = await tx.offer.findUnique({ where: { id } });
  if (existingById) {
    return tx.offer.update({
      where: { id },
      data,
    });
  }
  return tx.offer.create({
    data: { id, ...data },
  });
}

async function upsertOfferVersion(tx, id, data) {
  const existing = await tx.offerVersion.findUnique({
    where: { offerId_versionNumber: { offerId: data.offerId, versionNumber: data.versionNumber } },
  });
  if (existing) {
    return tx.offerVersion.update({
      where: { id: existing.id },
      data,
    });
  }
  const existingById = await tx.offerVersion.findUnique({ where: { id } });
  if (existingById) {
    return tx.offerVersion.update({
      where: { id },
      data,
    });
  }
  return tx.offerVersion.create({
    data: { id, ...data },
  });
}

// B6: link demo candidates' typed skills to the active skill library, and give a few
// clinical candidates evidenced "Clinical Experience" / "DHA/MOH License" (the demo jobs'
// required skills) so a fresh demo DB has suggestions. Idempotent.
async function linkDemoSkills(tx, orgId) {
  const key = (v) => String(v ?? '').replace(/[\u00a0\u2007\u202f]/g, ' ').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  const library = await tx.masterDataValue.findMany({ where: { organizationId: orgId, category: 'skills', status: 'Active' }, select: { id: true, name: true } });
  const byKey = new Map(library.map((v) => [key(v.name), v.id]));
  const candidates = await tx.candidate.findMany({ where: { organizationId: orgId, status: 'Active' }, select: { id: true, email: true, skills: true }, orderBy: { candidateCode: 'asc' } });
  const links = [];
  for (const c of candidates) for (const s of c.skills) { const id = byKey.get(key(s)); if (id) links.push({ organizationId: orgId, candidateId: c.id, skillId: id }); }
  if (links.length) await tx.candidateSkill.createMany({ data: links, skipDuplicates: true });
  const byEmail = new Map(candidates.map((c) => [c.email, c.id]));
  // VAC-DEMO-2026-001 required skills are 5. Evidence is spread so Match Skills shows 5/5, 4/5, 3/5, 2/5, and 0/5.
  const evidencePlan = [
    ['nour.ali@sample.com', 'DHA/MOH License', 'CV_TEXT', 'demo-cv', 'DHA/MOH License listed on the uploaded CV.'],
    ['nour.ali@sample.com', 'Clinical Experience', 'SCREENING_NOTE', 'demo-screen', 'Clinical Experience confirmed during screening.'],
    ['nour.ali@sample.com', 'ICU', 'SCORECARD', 'demo-interview', 'ICU competency scored at interview.'],
    ['nour.ali@sample.com', 'BLS/ACLS', 'MANUAL', 'demo-manual', 'BLS/ACLS card checked by the recruiter.'],
    ['nour.ali@sample.com', 'IV Therapy', 'CV_TEXT', 'demo-cv-iv', 'IV Therapy listed on the CV.'],
    ['heba.salah@sample.com', 'DHA/MOH License', 'CV_TEXT', 'demo-cv', 'DHA/MOH License listed on the uploaded CV.'],
    ['heba.salah@sample.com', 'Clinical Experience', 'SCREENING_NOTE', 'demo-screen', 'Clinical Experience confirmed during screening.'],
    ['heba.salah@sample.com', 'ICU', 'SCORECARD', 'demo-interview', 'ICU competency scored at interview.'],
    ['heba.salah@sample.com', 'BLS/ACLS', 'MANUAL', 'demo-manual', 'BLS/ACLS card checked by the recruiter.'],
    ['sara.ahmed.cand@sample.com', 'DHA/MOH License', 'CV_TEXT', 'demo-cv', 'DHA/MOH License listed on the uploaded CV.'],
    ['sara.ahmed.cand@sample.com', 'Clinical Experience', 'MANUAL', 'demo-manual', 'Clinical Experience noted by the recruiter.'],
    ['sara.ahmed.cand@sample.com', 'ICU', 'SCREENING_NOTE', 'demo-screen', 'ICU shift history confirmed at screening.'],
    ['lina.mostafa@sample.com', 'DHA/MOH License', 'CV_TEXT', 'demo-cv', 'DHA/MOH License listed on the uploaded CV.'],
    ['lina.mostafa@sample.com', 'Clinical Experience', 'MANUAL', 'demo-manual', 'Clinical Experience noted by the recruiter.'],
    ['ahmed.farag@sample.com', 'MRI', 'CV_TEXT', 'demo-cv', 'MRI experience listed on the CV.'],
    ['ahmed.farag@sample.com', 'CT Scan', 'SCREENING_NOTE', 'demo-screen', 'CT Scan competency confirmed at screening.'],
    ['ahmed.farag@sample.com', 'PACS', 'MANUAL', 'demo-manual', 'PACS access confirmed by the recruiter.'],
    ['ahmed.samir@sample.com', 'Clinical Pharmacy', 'CV_TEXT', 'demo-cv', 'Clinical Pharmacy experience listed on the CV.'],
    ['ahmed.samir@sample.com', 'Dispensing', 'MANUAL', 'demo-manual', 'Dispensing practice confirmed by the recruiter.'],
  ];
  for (const [email, skillName, sourceType, sourceRef, snippet] of evidencePlan) {
    const candidateId = byEmail.get(email);
    const skillId = byKey.get(key(skillName));
    if (!candidateId || !skillId) continue;
    const link = await tx.candidateSkill.upsert({ where: { candidateId_skillId: { candidateId, skillId } }, create: { organizationId: orgId, candidateId, skillId }, update: {} });
    const exists = await tx.candidateSkillEvidence.findFirst({ where: { candidateSkillId: link.id, sourceType, sourceRef } });
    if (!exists) await tx.candidateSkillEvidence.create({ data: { candidateSkillId: link.id, sourceType, sourceRef, snippet } });
  }
  return links.length;
}

async function seedDemoFixtures(tx, { organization, branch, position, users: seededUsers }) {
  const userRows = await tx.user.findMany({ where: { organizationId: organization.id } });
  const usersByEmail = Object.fromEntries(userRows.map((user) => [user.email, user]));

  // ── 1. Core Users (Real Saudi German Health Team) ───────────
  const admin = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'ahmed.mahmoud@recruitflow.local' } },
    update: { displayName: 'Ahmed Mahmoud', jobTitle: 'HR Director', status: 'Active' },
    create: {
      id: fixtureId(150),
      organizationId: organization.id,
      email: 'ahmed.mahmoud@recruitflow.local',
      emailNormalized: 'ahmed.mahmoud@recruitflow.local',
      displayName: 'Ahmed Mahmoud',
      jobTitle: 'HR Director',
      passwordHash: DEMO_PASSWORD_HASH,
      status: 'Active',
    },
  });

  const recruiterSarah = usersByEmail['sarah.ahmed@recruitflow.local'] ?? admin;
  const hiringManagerHassan = usersByEmail['hassan.ali@recruitflow.local'] ?? admin;

  // Additional Real SGH Recruiters from 2026 Vacant List
  const recruiterSindu = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'sindu@recruitflow.local' } },
    update: { displayName: 'Sindu', jobTitle: 'Senior Recruiter', status: 'Active' },
    create: { id: fixtureId(151), organizationId: organization.id, email: 'sindu@recruitflow.local', emailNormalized: 'sindu@recruitflow.local', displayName: 'Sindu', jobTitle: 'Senior Recruiter', passwordHash: DEMO_PASSWORD_HASH, status: 'Active' },
  });

  const recruiterZenah = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'zenah@recruitflow.local' } },
    update: { displayName: 'Zenah', jobTitle: 'Recruiter', status: 'Active' },
    create: { id: fixtureId(152), organizationId: organization.id, email: 'zenah@recruitflow.local', emailNormalized: 'zenah@recruitflow.local', displayName: 'Zenah', jobTitle: 'Recruiter', passwordHash: DEMO_PASSWORD_HASH, status: 'Active' },
  });

  const recruiterLady = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'lady@recruitflow.local' } },
    update: { displayName: 'Lady', jobTitle: 'Nursing Recruiter', status: 'Active' },
    create: { id: fixtureId(153), organizationId: organization.id, email: 'lady@recruitflow.local', emailNormalized: 'lady@recruitflow.local', displayName: 'Lady', jobTitle: 'Nursing Recruiter', passwordHash: DEMO_PASSWORD_HASH, status: 'Active' },
  });

  const hiringManagerOmarH = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'omar.hassan@recruitflow.local' } },
    update: { displayName: 'Omar Hassan', jobTitle: 'Hiring Manager', status: 'Active' },
    create: { id: fixtureId(154), organizationId: organization.id, email: 'omar.hassan@recruitflow.local', emailNormalized: 'omar.hassan@recruitflow.local', displayName: 'Omar Hassan', jobTitle: 'Hiring Manager', passwordHash: DEMO_PASSWORD_HASH, status: 'Active' },
  });

  const financeYousef = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'yousef.hamdy@recruitflow.local' } },
    update: { displayName: 'Yousef Hamdy', jobTitle: 'Finance', status: 'Active' },
    create: { id: fixtureId(155), organizationId: organization.id, email: 'yousef.hamdy@recruitflow.local', emailNormalized: 'yousef.hamdy@recruitflow.local', displayName: 'Yousef Hamdy', jobTitle: 'Finance', passwordHash: DEMO_PASSWORD_HASH, status: 'Active' },
  });

  const legalHeba = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'heba.salem@recruitflow.local' } },
    update: { displayName: 'Heba Salem', jobTitle: 'Legal', status: 'Active' },
    create: { id: fixtureId(156), organizationId: organization.id, email: 'heba.salem@recruitflow.local', emailNormalized: 'heba.salem@recruitflow.local', displayName: 'Heba Salem', jobTitle: 'Legal', passwordHash: DEMO_PASSWORD_HASH, status: 'Active' },
  });

  // ── 1b. User-Management Demo Personas ─────────────────────
  // demo.multi is the 3-role demo user (ADMINISTRATOR + HIRING_MANAGER +
  // RECRUITER); new.employee is the forced first-login password-change test
  // user (mustChangePassword: true, reports to demo.multi). All four share
  // the standard local-dev seed password hash (DEMO_PASSWORD_HASH, same
  // literal as every other demo user). NOTE: mustChangePassword /
  // passwordChangedAt come from the user-management migration on User; that
  // migration must be applied before this seed runs against a database.
  const demoMulti = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'demo.multi@recruitflow.local' } },
    update: { displayName: 'Demo Multi-Role Lead', jobTitle: 'Multi-Role Lead', status: 'Active', mustChangePassword: false },
    create: { id: fixtureId(157), organizationId: organization.id, email: 'demo.multi@recruitflow.local', emailNormalized: 'demo.multi@recruitflow.local', displayName: 'Demo Multi-Role Lead', jobTitle: 'Multi-Role Lead', passwordHash: DEMO_PASSWORD_HASH, status: 'Active', mustChangePassword: false, passwordChangedAt: null },
  });

  const karimRecruiter = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'karim.recruiter@recruitflow.local' } },
    update: { displayName: 'Karim Recruiter', jobTitle: 'Recruiter', status: 'Active', mustChangePassword: false },
    create: { id: fixtureId(158), organizationId: organization.id, email: 'karim.recruiter@recruitflow.local', emailNormalized: 'karim.recruiter@recruitflow.local', displayName: 'Karim Recruiter', jobTitle: 'Recruiter', passwordHash: DEMO_PASSWORD_HASH, status: 'Active', mustChangePassword: false, passwordChangedAt: null },
  });

  const karimInterviewer = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'dr.karim.interviewer@recruitflow.local' } },
    update: { displayName: 'Dr. Karim Interviewer', jobTitle: 'Interviewer', status: 'Active', mustChangePassword: false },
    create: { id: fixtureId(159), organizationId: organization.id, email: 'dr.karim.interviewer@recruitflow.local', emailNormalized: 'dr.karim.interviewer@recruitflow.local', displayName: 'Dr. Karim Interviewer', jobTitle: 'Interviewer', passwordHash: DEMO_PASSWORD_HASH, status: 'Active', mustChangePassword: false, passwordChangedAt: null },
  });

  const newEmployee = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'new.employee@recruitflow.local' } },
    update: { displayName: 'New Employee', jobTitle: 'Recruiter', status: 'Active', mustChangePassword: true },
    create: { id: fixtureId(160), organizationId: organization.id, email: 'new.employee@recruitflow.local', emailNormalized: 'new.employee@recruitflow.local', displayName: 'New Employee', jobTitle: 'Recruiter', passwordHash: DEMO_PASSWORD_HASH, status: 'Active', mustChangePassword: true, passwordChangedAt: null },
  });

  // Assign roles
  const recruiterRole = await tx.role.findUnique({ where: { code: 'RECRUITER' } });
  const hmRole = await tx.role.findUnique({ where: { code: 'HIRING_MANAGER' } });
  if (recruiterRole) {
    for (const u of [recruiterSindu, recruiterZenah, recruiterLady]) {
      await tx.userRole.upsert({ where: { userId_roleId: { userId: u.id, roleId: recruiterRole.id } }, update: {}, create: { userId: u.id, roleId: recruiterRole.id } });
    }
  }
  if (hmRole) {
    for (const u of [hiringManagerOmarH, financeYousef, legalHeba]) {
      await tx.userRole.upsert({ where: { userId_roleId: { userId: u.id, roleId: hmRole.id } }, update: {}, create: { userId: u.id, roleId: hmRole.id } });
    }
  }
  // User-management personas: demo.multi holds 3 roles at once; the two
  // Karims and new.employee hold one role each.
  const adminRole = await tx.role.findUnique({ where: { code: 'ADMINISTRATOR' } });
  const interviewerRole = await tx.role.findUnique({ where: { code: 'INTERVIEWER' } });
  if (adminRole && hmRole && recruiterRole) {
    for (const role of [adminRole, hmRole, recruiterRole]) {
      await tx.userRole.upsert({ where: { userId_roleId: { userId: demoMulti.id, roleId: role.id } }, update: {}, create: { userId: demoMulti.id, roleId: role.id } });
    }
  }
  if (recruiterRole) {
    for (const u of [karimRecruiter, newEmployee]) {
      await tx.userRole.upsert({ where: { userId_roleId: { userId: u.id, roleId: recruiterRole.id } }, update: {}, create: { userId: u.id, roleId: recruiterRole.id } });
    }
  }
  if (interviewerRole) {
    await tx.userRole.upsert({ where: { userId_roleId: { userId: karimInterviewer.id, roleId: interviewerRole.id } }, update: {}, create: { userId: karimInterviewer.id, roleId: interviewerRole.id } });
  }

  // Hassan (top) -> Mona and Omar. Mona -> Sarah, Sindu, Zenah. Omar -> Lady.
  const talentManagerMona = usersByEmail['mona.manager@recruitflow.local'] ?? null;
  if (talentManagerMona && hiringManagerHassan.id !== admin.id) {
    await tx.user.update({ where: { id: talentManagerMona.id }, data: { managerId: hiringManagerHassan.id } });
    await tx.user.update({ where: { id: hiringManagerOmarH.id }, data: { managerId: hiringManagerHassan.id } });
    await tx.user.update({ where: { id: recruiterSarah.id }, data: { managerId: talentManagerMona.id } });
    await tx.user.update({ where: { id: recruiterSindu.id }, data: { managerId: talentManagerMona.id } });
    await tx.user.update({ where: { id: recruiterZenah.id }, data: { managerId: talentManagerMona.id } });
    await tx.user.update({ where: { id: recruiterLady.id }, data: { managerId: hiringManagerOmarH.id } });
    // User-management hierarchy (3 levels, visible in /users?view=tree):
    // Hassan -> Demo Multi -> New Employee; Omar Hassan -> Karim Recruiter
    // + Dr. Karim Interviewer (Team B); Mona -> Omar Nasser (License
    // Specialist, Team A). Every new RECRUITER above has a non-null
    // managerId, so seedDecisionDemo's recruiter sweep (seed.cjs) leaves
    // them alone instead of re-parenting them under Mona.
    await tx.user.update({ where: { id: demoMulti.id }, data: { managerId: hiringManagerHassan.id } });
    await tx.user.update({ where: { id: newEmployee.id }, data: { managerId: demoMulti.id } });
    await tx.user.update({ where: { id: karimRecruiter.id }, data: { managerId: hiringManagerOmarH.id } });
    await tx.user.update({ where: { id: karimInterviewer.id }, data: { managerId: hiringManagerOmarH.id } });
    const omarNasser = usersByEmail['omar.nasser@recruitflow.local'];
    if (omarNasser) await tx.user.update({ where: { id: omarNasser.id }, data: { managerId: talentManagerMona.id } });
  }

  // ── 2. Real Branches from 2026 Manpower List ───────────────
  const orgId = organization.id;
  const branches = {
    dubai: await upsertBranch(tx, orgId, fixtureId(101), 'DXB-MAIN', 'SGH Dubai Hospital', 'Dubai'),
    ajman: await upsertBranch(tx, orgId, fixtureId(102), 'AJM-HOSP', 'SGH Ajman Hospital', 'Ajman'),
    sharjah: await upsertBranch(tx, orgId, fixtureId(103), 'SHJ-HOSP', 'SGH Sharjah Hospital', 'Sharjah'),
    mentalHealth: await upsertBranch(tx, orgId, fixtureId(104), 'DXB-PSYCH', 'Mental Health Center Dubai', 'Dubai'),
    rak: await upsertBranch(tx, orgId, fixtureId(105), 'RAK-CLINIC', 'SGH Clinic RAK', 'Ras Al Khaimah'),
    alSuyouh: await upsertBranch(tx, orgId, fixtureId(106), 'SUYOUH-CLN', 'SGH Clinic Al Suyouh', 'Sharjah'),
    group: await upsertBranch(tx, orgId, fixtureId(107), 'GRP-HQ', 'SGH Group Corporate Office', 'Dubai'),
  };

  await tx.user.updateMany({ where: { id: admin.id }, data: { branchId: branches.group.id } });
  await tx.user.updateMany({ where: { id: { in: [recruiterSarah.id, recruiterSindu.id, recruiterZenah.id, hiringManagerHassan.id, hiringManagerOmarH.id, talentManagerMona?.id, demoMulti.id, karimRecruiter.id, karimInterviewer.id, newEmployee.id].filter(Boolean) } }, data: { branchId: branches.dubai.id } });
  await tx.user.updateMany({ where: { id: recruiterLady.id }, data: { branchId: branches.ajman.id } });
  await tx.user.updateMany({ where: { id: { in: [financeYousef.id, legalHeba.id] } }, data: { branchId: branches.group.id } });
  await tx.user.updateMany({ where: { id: hiringManagerHassan.id }, data: { displayName: 'Hassan Ali', jobTitle: 'Hiring Manager' } });

  // ── 3. Real Positions from 2026 Manpower List ──────────────
  const positions = {
    cardiologist: await upsertPosition(tx, orgId, fixtureId(110), 'CONS-CARDIO', 'Consultant Cardiologist Intervention', 'Department: Cardiology | Level: Consultant'),
    cardioSpec: await upsertPosition(tx, orgId, fixtureId(111), 'SPEC-CARDIO', 'Cardiology Specialist', 'Department: Cardiology | Level: Specialist'),
    psychiatrist: await upsertPosition(tx, orgId, fixtureId(112), 'CONS-PSYCH', 'Consultant Psychiatrist', 'Department: Mental Health | Level: Consultant'),
    counselor: await upsertPosition(tx, orgId, fixtureId(113), 'COUNS-PSYCH', 'Counselor', 'Department: Mental Health | Level: Specialist'),
    childPsych: await upsertPosition(tx, orgId, fixtureId(114), 'CHILD-PSYCH', 'Child Psychiatrist', 'Department: Mental Health | Level: Consultant'),
    urologist: await upsertPosition(tx, orgId, fixtureId(115), 'SPEC-UROL', 'Urology Specialist', 'Department: Urology | Level: Specialist'),
    staffNurse: await upsertPosition(tx, orgId, fixtureId(116), 'STAFF-NURSE', 'Registered Nurse', 'Department: Nursing | Level: Staff'),
    midwife: await upsertPosition(tx, orgId, fixtureId(117), 'MIDWIFE-LDU', 'Midwife', 'Department: LDU | Level: Staff'),
    radTech: await upsertPosition(tx, orgId, fixtureId(118), 'RAD-TECH', 'Radiology Technician', 'Department: Radiology | Level: Senior'),
    pharmacist: await upsertPosition(tx, orgId, fixtureId(119), 'PHARM-SPEC', 'Pharmacist', 'Department: Pharmacy | Level: Staff'),
    itSupport: await upsertPosition(tx, orgId, fixtureId(120), 'IT-SUPP', 'IT Support Specialist', 'Department: IT | Level: Mid'),
    cyberSec: await upsertPosition(tx, orgId, fixtureId(121), 'CYBER-ENG', 'Cyber Security Engineer', 'Department: IT | Level: Senior'),
    medCoder: await upsertPosition(tx, orgId, fixtureId(122), 'MED-CODER', 'Medical Coder', 'Department: Health Info | Level: Mid'),
    dermatologist: await upsertPosition(tx, orgId, fixtureId(124), 'SPEC-DERMA', 'Specialist Dermatologist', 'Department: Dermatology | Level: Specialist'),
    csrLead: await upsertPosition(tx, orgId, fixtureId(125), 'CSR-LEAD', 'CSR Team Leader', 'Department: Patient Relations | Level: Senior'),
    dentAsst: await upsertPosition(tx, orgId, fixtureId(126), 'DENT-ASST', 'Dental Assistant', 'Department: Dental | Level: Staff'),
    obsGyn: await upsertPosition(tx, orgId, fixtureId(127), 'SPEC-OBGYN', 'Specialist Obs/Gyn', 'Department: Obstetrics & Gyne | Level: Specialist'),
  };

  const hrSpecPos = await tx.position.findUnique({ where: { organizationId_code: { organizationId: orgId, code: 'HR-SPEC' } } });
  positions.hrSpec = hrSpecPos ?? positions.itSupport;

  // ── 4. Real Candidates ─────────────────────────────────────
  const candidateSeeds = [
    { email: 'nour.ali@sample.com', firstName: 'Nour', lastName: 'Ali', phone: '+966501234567', currentTitle: 'Registered Nurse', currentCompany: 'Care Hospital', source: 'LinkedIn', skills: ['DHA/MOH License', 'Clinical Experience', 'ICU', 'BLS/ACLS', 'IV Therapy'], location: 'Riyadh', experienceYears: 5 },
    { email: 'heba.salah@sample.com', firstName: 'Heba', lastName: 'Salah', phone: '+966549876543', currentTitle: 'Registered Nurse (ICU)', currentCompany: 'King Faisal Hospital', source: 'Referral', skills: ['DHA/MOH License', 'Clinical Experience', 'ICU', 'BLS/ACLS'], location: 'Riyadh', experienceYears: 4 },
    { email: 'lina.mostafa@sample.com', firstName: 'Lina', lastName: 'Mostafa', phone: '+966554321098', currentTitle: 'Registered Nurse (Peds)', currentCompany: 'SGH Cairo', source: 'Career Site', skills: ['DHA/MOH License', 'Clinical Experience'], location: 'Jeddah', experienceYears: 3 },
    { email: 'dr.osama.ali@sample.com', firstName: 'Osama', lastName: 'Ali', phone: '+971501112233', currentTitle: 'Consultant Psychiatrist', currentCompany: 'Al Amal Psychiatric', source: 'Direct Search', skills: ['Psychiatry', 'Psychopharmacology'], location: 'Dubai', experienceYears: 12 },
    { email: 'christina.beatric@sample.com', firstName: 'Christina', lastName: 'Beatric', phone: '+971523334455', currentTitle: 'Counselor', currentCompany: 'Wellness Clinic Dubai', source: 'Referral', skills: ['CBT', 'Child Counseling'], location: 'Dubai', experienceYears: 8 },
    { email: 'dr.abhimanyu@sample.com', firstName: 'Abhimanyu', lastName: 'Gupta', phone: '+971565556677', currentTitle: 'Specialist Urologist', currentCompany: 'Apollo Hospital', source: 'LinkedIn', skills: ['Endourology', 'Laparoscopy'], location: 'Dubai', experienceYears: 10 },
    { email: 'dr.sherif@sample.com', firstName: 'Sherif', lastName: 'Hidar', phone: '+971507778899', currentTitle: 'Urology Consultant', currentCompany: 'Dubai Health Authority', source: 'Headhunt', skills: ['Urology Surgery', 'Robotic Surgery'], location: 'Dubai', experienceYears: 15 },
    { email: 'dr.mozna@sample.com', firstName: 'Mozna', lastName: 'Al-Hashemi', phone: '+971559990011', currentTitle: 'Specialist Dermatologist', currentCompany: 'DermaCare Dubai', source: 'Walk-in', skills: ['Clinical Dermatology', 'Laser Therapy'], location: 'Ajman', experienceYears: 7 },
    { email: 'tasabeeh.m@sample.com', firstName: 'Tasabeeh', lastName: 'Mustafa', phone: '+971542223344', currentTitle: 'Staff Nurse (MSW)', currentCompany: 'Khartoum Medical', source: 'Agency', skills: ['Medical-Surgical', 'BLS'], location: 'Sharjah', experienceYears: 4 },
    { email: 'salam.arikat@sample.com', firstName: 'Salam', lastName: 'Arikat', phone: '+971504445566', currentTitle: 'Senior Midwife', currentCompany: 'Ajman Maternity', source: 'LinkedIn', skills: ['Labor & Delivery', 'Fetal Monitoring'], location: 'Ajman', experienceYears: 9 },
    { email: 'ahmed.farag@sample.com', firstName: 'Ahmed', lastName: 'Farag', phone: '+966506667788', currentTitle: 'Radiology Technician', currentCompany: 'Riyadh Care', source: 'Career Site', skills: ['MRI', 'CT Scan', 'PACS'], location: 'Riyadh', experienceYears: 6 },
    { email: 'ahmed.samir@sample.com', firstName: 'Ahmed', lastName: 'Samir', phone: '+966538889900', currentTitle: 'Pharmacist', currentCompany: 'Nahdi Medical', source: 'LinkedIn', skills: ['Clinical Pharmacy', 'Dispensing'], location: 'Jeddah', experienceYears: 4 },
    { email: 'mariam.essam@sample.com', firstName: 'Mariam', lastName: 'Essam', phone: '+966550001122', currentTitle: 'Medical Coder', currentCompany: 'Al Habib Medical', source: 'LinkedIn', skills: ['ICD-10', 'CPT', 'Revenue Cycle'], location: 'Riyadh', experienceYears: 5 },
    { email: 'kareem.fathy@sample.com', firstName: 'Kareem', lastName: 'Fathy', phone: '+966502223344', currentTitle: 'IT Support Specialist', currentCompany: 'SGH IT', source: 'Employee Ref', skills: ['Active Directory', 'Networking'], location: 'Dubai', experienceYears: 3 },
    { email: 'yousef.magdy@sample.com', firstName: 'Yousef', lastName: 'Magdy', phone: '+966544445566', currentTitle: 'IT Support Specialist', currentCompany: 'TechServices UAE', source: 'Employee Ref', skills: ['Helpdesk', 'Windows Server'], location: 'Dubai', experienceYears: 4 },
    { email: 'mai.wahba@sample.com', firstName: 'Mai', lastName: 'Wahba', phone: '+966566667788', currentTitle: 'HR Specialist', currentCompany: 'Alpha Health', source: 'Agency', skills: ['Onboarding', 'HRIS'], location: 'Riyadh', experienceYears: 4 },
    { email: 'hassan.talaat@sample.com', firstName: 'Hassan', lastName: 'Talaat', phone: '+966538889911', currentTitle: 'Clinical Pharmacist', currentCompany: 'Dallah Hospital', source: 'LinkedIn', skills: ['Pharmacotherapy', 'IV Admixtures'], location: 'Riyadh', experienceYears: 5 },
    { email: 'omar.h.cand@sample.com', firstName: 'Omar', lastName: 'Hassan', phone: '+966509991122', currentTitle: 'Senior Radiology Tech', currentCompany: 'Mouwasat Hospital', source: 'Career Site', skills: ['CT', 'Diagnostic Radiography'], location: 'Jeddah', experienceYears: 7 },
    { email: 'sara.ahmed.cand@sample.com', firstName: 'Sara', lastName: 'Ahmed', phone: '+966541113355', currentTitle: 'Staff Nurse', currentCompany: 'Saudi German Hospital', source: 'Career Site', skills: ['DHA/MOH License', 'Clinical Experience', 'ICU'], location: 'Riyadh', experienceYears: 4 },
    { email: 'nabil.ahmed@sample.com', firstName: 'Nabil', lastName: 'Ahmed', phone: '+966553335577', currentTitle: 'Senior Registered Nurse', currentCompany: 'Aster Clinic', source: 'Referral', skills: ['ICU', 'Clinical Experience'], location: 'Dubai', experienceYears: 8 },
    { email: 'rania.kamel@sample.com', firstName: 'Rania', lastName: 'Kamel', phone: '+971501110001', currentTitle: null, currentCompany: null, source: 'Upload', skills: [], location: 'Dubai', experienceYears: null, metadata: { cvExtractionStatus: 'Needs review', rawText: 'Experienced ICU Nurse with DHA/MOH License, BLS, ACLS, and Critical Care background in Dubai.' }, cv: { scanStatus: 'Clean' } },
    { email: 'tariq.mansour@sample.com', firstName: 'Tariq', lastName: 'Mansour', phone: '+971501110002', currentTitle: null, currentCompany: null, source: 'Upload', skills: [], location: 'Dubai', experienceYears: null, metadata: { cvExtractionStatus: 'Needs review', rawText: 'Experienced ICU Nurse with DHA/MOH License, BLS, ACLS, and Critical Care background in Dubai.' }, cv: { scanStatus: 'Clean' } },
    { email: 'farida.nabil@sample.com', firstName: 'Farida', lastName: 'Nabil', phone: '+971501110003', currentTitle: 'Staff Nurse', currentCompany: 'City Hospital', source: 'Upload', skills: ['ICU'], location: 'Sharjah', experienceYears: 2, metadata: { cvExtractionStatus: 'Pending' }, cv: { scanStatus: 'Pending' } },
    { email: 'walid.gamal@sample.com', firstName: 'Walid', lastName: 'Gamal', phone: '+971501110004', currentTitle: 'Registered Nurse', currentCompany: 'Unknown', source: 'Upload', skills: ['ICU'], location: 'Ajman', experienceYears: 6, metadata: { cvExtractionStatus: 'Failed' }, cv: { scanStatus: 'Quarantined' } },
    { email: 'hala.midwife@sample.com', firstName: 'Hala', lastName: 'Nasser', phone: '+971501110005', currentTitle: 'Midwife', currentCompany: 'Ajman Maternity', source: 'Referral', skills: ['Labor & Delivery', 'Fetal Monitoring', 'DHA/MOH License'], location: 'Ajman', experienceYears: 6 },
    { email: 'huda.pharm@sample.com', firstName: 'Huda', lastName: 'Saleh', phone: '+971501110006', currentTitle: 'Clinical Pharmacist', currentCompany: 'Ajman Pharmacy', source: 'Career Site', skills: ['Clinical Pharmacy', 'Dispensing', 'DHA/MOH License'], location: 'Ajman', experienceYears: 5 },
  ];

  for (let i = 0; i < candidateSeeds.length; i++) {
    const c = candidateSeeds[i];
    await upsertCandidate(tx, orgId, fixtureId(200 + i), {
      candidateCode: `CND-SGH-${String(i + 1).padStart(3, '0')}`,
      firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone,
      currentTitle: c.currentTitle ?? null, currentCompany: c.currentCompany ?? null, source: c.source,
      skills: c.skills, location: c.location, experienceYears: c.experienceYears ?? null,
      ...(c.metadata ? { metadata: c.metadata } : {}),
    });
  }

  const candidateRows = await tx.candidate.findMany({ where: { organizationId: orgId } });
  const cByEmail = Object.fromEntries(candidateRows.map((c) => [c.email, c]));

  // ── 4b. Real CV Documents for CV Bank ─────────────────────
  for (let i = 0; i < candidateSeeds.length; i++) {
    const c = candidateSeeds[i];
    const cand = cByEmail[c.email];
    if (!cand) continue;
    const scanStatus = c.cv?.scanStatus ?? 'Clean';
    const extractionText = c.metadata?.rawText
      ?? (scanStatus === 'Clean' && c.skills?.length
        ? `${c.firstName} ${c.lastName}, ${c.currentTitle ?? 'candidate'}. Skills: ${c.skills.join(', ')}.`
        : null);
    const docData = {
      fileName: `${c.firstName}_${c.lastName}_Resume_2026.pdf`,
      fileSize: 1024 * (120 + i * 15),
      mimeType: 'application/pdf',
      storageKey: `cvs/${orgId}/${cand.id}/resume.pdf`,
      storageProvider: 'local-private',
      scanStatus,
      extractionText,
      parserStatus: scanStatus === 'Quarantined' ? 'Failed' : scanStatus === 'Pending' ? 'NotStarted' : 'Parsed',
      consentStatus: 'Active',
      retentionExpiresAt: dateFromNow(365),
    };
    const existingDoc = await tx.candidateDocument.findFirst({
      where: { organizationId: orgId, candidateId: cand.id, documentType: 'CV' },
    });
    if (existingDoc) {
      await tx.candidateDocument.update({ where: { id: existingDoc.id }, data: docData });
    } else {
      await tx.candidateDocument.create({
        data: { id: fixtureId(250 + i), organizationId: orgId, candidateId: cand.id, documentType: 'CV', ...docData },
      });
    }
  }

  // ── 5. Real Vacancy Requisitions ───────────────────────────
  const requestSeeds = [
    { id: fixtureId(301), code: 'VR-DEMO-2026-001', pos: positions.staffNurse, br: branches.dubai, req: hiringManagerOmarH, status: 'Approved', headcount: 8, empType: 'Full-time', reason: 'ICU Wing 3 Expansion', budget: 'Budgeted', crit: 'Critical', startDays: 15 },
    { id: fixtureId(302), code: 'VR-DEMO-2026-002', pos: positions.radTech, br: branches.dubai, req: hiringManagerHassan, status: 'Approved', headcount: 3, empType: 'Full-time', reason: 'MRI Suite 24/7 Coverage', budget: 'Budgeted', crit: 'High', startDays: 30 },
    { id: fixtureId(303), code: 'VR-DEMO-2026-003', pos: positions.pharmacist, br: branches.ajman, req: recruiterSindu, status: 'Approved', headcount: 2, empType: 'Full-time', reason: 'Inpatient Pharmacy Backfill', budget: 'Budgeted', crit: 'Normal', startDays: 35 },
    { id: fixtureId(304), code: 'VR-DEMO-2026-004', pos: positions.psychiatrist, br: branches.mentalHealth, req: recruiterZenah, status: 'Approved', headcount: 1, empType: 'Full-time', reason: 'Outpatient Psychiatry Expansion', budget: 'Budgeted', crit: 'Critical', startDays: 20 },
    { id: fixtureId(305), code: 'VR-DEMO-2026-005', pos: positions.counselor, br: branches.mentalHealth, req: recruiterZenah, status: 'Approved', headcount: 1, empType: 'Full-time', reason: 'Child & Adolescent Counseling', budget: 'Budgeted', crit: 'Normal', startDays: 45 },
    { id: fixtureId(306), code: 'VR-DEMO-2026-006', pos: positions.urologist, br: branches.dubai, req: recruiterZenah, status: 'Approved', headcount: 1, empType: 'Full-time', reason: 'Replacement for Dr. Sherif', budget: 'Budgeted', crit: 'Critical', startDays: 10 },
    { id: fixtureId(307), code: 'VR-DEMO-2026-007', pos: positions.itSupport, br: branches.group, req: recruiterSindu, status: 'Pending Approval', headcount: 2, empType: 'Full-time', reason: 'HIS Infrastructure Rollout', budget: 'Budgeted', crit: 'Normal', startDays: 40 },
    { id: fixtureId(308), code: 'VR-DEMO-2026-008', pos: positions.midwife, br: branches.ajman, req: recruiterLady, status: 'Approved', headcount: 2, empType: 'Full-time', reason: 'LDU Shift Coverage', budget: 'Budgeted', crit: 'Critical', startDays: 14 },
    { id: fixtureId(309), code: 'VR-DEMO-2026-009', pos: positions.medCoder, br: branches.dubai, req: recruiterSarah, status: 'Approved', headcount: 2, empType: 'Full-time', reason: 'Insurance Revenue Cycle', budget: 'Budgeted', crit: 'Normal', startDays: 60 },
    { id: fixtureId(310), code: 'VR-DEMO-2026-010', pos: positions.hrSpec, br: branches.group, req: admin, status: 'Draft', headcount: 1, empType: 'Full-time', reason: 'Talent Acquisition Team', budget: 'Budgeted', crit: 'Normal', startDays: 90 },
    { id: fixtureId(311), code: 'VR-DEMO-2026-011', pos: positions.cardioSpec, br: branches.dubai, req: talentManagerMona ?? hiringManagerHassan, status: 'Pending Approval', headcount: 2, empType: 'Full-time', reason: 'Cardiology coverage for two suites', budget: 'Budgeted', crit: 'Critical', startDays: 21 },
    { id: fixtureId(312), code: 'VR-DEMO-2026-012', pos: positions.dermatologist, br: branches.dubai, req: talentManagerMona ?? hiringManagerHassan, status: 'Changes Requested', headcount: 1, empType: 'Full-time', reason: 'Laser clinic expansion', budget: 'Budgeted', crit: 'High', startDays: 40 },
    { id: fixtureId(313), code: 'VR-DEMO-2026-013', pos: positions.cyberSec, br: branches.group, req: talentManagerMona ?? hiringManagerHassan, status: 'Approved', headcount: 1, empType: 'Full-time', reason: 'Security operations hire', budget: 'Budgeted', crit: 'High', startDays: 30 },
    { id: fixtureId(314), code: 'VR-DEMO-2026-014', pos: positions.dentAsst, br: branches.sharjah, req: recruiterLady, status: 'Approved', headcount: 1, empType: 'Full-time', reason: 'Dental chair coverage', budget: 'Budgeted', crit: 'Normal', startDays: 25 },
    { id: fixtureId(315), code: 'VR-DEMO-2026-015', pos: positions.csrLead, br: branches.dubai, req: admin, status: 'Approved', headcount: 1, empType: 'Full-time', reason: 'CSR team backfill (closed before opening)', budget: 'Budgeted', crit: 'Normal', startDays: 30 },
    { id: fixtureId(316), code: 'VR-DEMO-2026-016', pos: positions.obsGyn, br: branches.dubai, req: demoMulti, status: 'Approved', headcount: 1, empType: 'Full-time', reason: 'Obstetrics coverage owned by Demo Multi-Role Lead', budget: 'Budgeted', crit: 'High', startDays: 21 },
  ];

  const reqMap = {};
  for (const r of requestSeeds) {
    const createdReq = await upsertVacancyRequest(tx, r.id, {
      organizationId: orgId, branchId: r.br.id, positionId: r.pos.id,
      requesterId: r.req.id, requestCode: r.code, status: r.status,
      requestedHeadcount: r.headcount, employmentType: r.empType, reason: r.reason,
      budgetStatus: r.budget, criticality: r.crit,
      targetStartDate: dateFromNow(r.startDays),
      targetFillDate: dateFromNow(r.startDays),
      justification: `${r.reason} - SGH 2026 Healthcare Manpower.`,
      submittedAt: r.status === 'Draft' ? null : dateFromNow(-10),
    });
    reqMap[r.code] = createdReq;
  }

  const grade6 = await tx.masterDataValue.findFirst({
    where: { organizationId: orgId, category: 'grades', name: 'Grade 6', status: 'Active' },
    select: { id: true },
  });
  if (grade6) {
    await tx.vacancyRequest.updateMany({
      where: { id: { in: Object.values(reqMap).map((row) => row.id) } },
      data: { gradeId: grade6.id },
    });
  }

  // ── 6. Real Vacancies ──────────────────────────────────────
  const vacancySeeds = [
    { id: fixtureId(401), code: 'VAC-DEMO-2026-001', reqCode: 'VR-DEMO-2026-001', pos: positions.staffNurse, br: branches.dubai, target: 8, days: 45 },
    { id: fixtureId(402), code: 'VAC-DEMO-2026-002', reqCode: 'VR-DEMO-2026-002', pos: positions.radTech, br: branches.dubai, target: 3, days: 62 },
    { id: fixtureId(403), code: 'VAC-DEMO-2026-003', reqCode: 'VR-DEMO-2026-003', pos: positions.pharmacist, br: branches.ajman, target: 2, days: 35 },
    { id: fixtureId(404), code: 'VAC-DEMO-2026-004', reqCode: 'VR-DEMO-2026-004', pos: positions.psychiatrist, br: branches.mentalHealth, target: 1, days: 125 },
    { id: fixtureId(405), code: 'VAC-DEMO-2026-005', reqCode: 'VR-DEMO-2026-005', pos: positions.counselor, br: branches.mentalHealth, target: 1, days: 125 },
    { id: fixtureId(406), code: 'VAC-DEMO-2026-006', reqCode: 'VR-DEMO-2026-006', pos: positions.urologist, br: branches.dubai, target: 1, days: 106 },
    { id: fixtureId(407), code: 'VAC-DEMO-2026-007', reqCode: 'VR-DEMO-2026-008', pos: positions.midwife, br: branches.ajman, target: 2, days: 30 },
    { id: fixtureId(408), code: 'VAC-DEMO-2026-008', reqCode: 'VR-DEMO-2026-009', pos: positions.medCoder, br: branches.dubai, target: 2, days: 36 },
    { id: fixtureId(409), code: 'VAC-DEMO-2026-009', reqCode: 'VR-DEMO-2026-014', pos: positions.dentAsst, br: branches.sharjah, target: 1, days: 12, status: 'On Hold', holdUntil: dateFromNow(14) },
    { id: fixtureId(410), code: 'VAC-DEMO-2026-010', reqCode: 'VR-DEMO-2026-015', pos: positions.csrLead, br: branches.dubai, target: 1, days: 20, status: 'Closed' },
    { id: fixtureId(411), code: 'VAC-DEMO-2026-011', reqCode: 'VR-DEMO-2026-016', pos: positions.obsGyn, br: branches.dubai, target: 1, days: 5 },
  ];

  const requiredSkillsByVacancy = {
    'VAC-DEMO-2026-001': ['DHA/MOH License', 'Clinical Experience', 'ICU', 'BLS/ACLS', 'IV Therapy'],
    'VAC-DEMO-2026-002': ['DHA/MOH License', 'MRI', 'CT Scan', 'PACS'],
    'VAC-DEMO-2026-003': ['DHA/MOH License', 'Clinical Pharmacy', 'Dispensing'],
    'VAC-DEMO-2026-004': ['DHA/MOH License', 'Psychiatry', 'Clinical Experience'],
    'VAC-DEMO-2026-005': ['DHA/MOH License', 'CBT', 'Clinical Experience'],
    'VAC-DEMO-2026-006': ['DHA/MOH License', 'Endourology', 'Robotic Tele-Console (Unmapped)'],
    'VAC-DEMO-2026-007': ['DHA/MOH License', 'Labor & Delivery', 'Fetal Monitoring'],
    'VAC-DEMO-2026-008': ['ICD-10', 'CPT', 'Revenue Cycle'],
    'VAC-DEMO-2026-009': ['Clinical Experience'],
    'VAC-DEMO-2026-010': ['Clinical Experience'],
    'VAC-DEMO-2026-011': ['DHA/MOH License', 'Labor & Delivery', 'Fetal Monitoring'],
  };
  const ownerByVacancy = {
    'VAC-DEMO-2026-001': recruiterSarah,
    'VAC-DEMO-2026-002': recruiterSindu,
    'VAC-DEMO-2026-003': recruiterSindu,
    'VAC-DEMO-2026-004': recruiterZenah,
    'VAC-DEMO-2026-005': recruiterZenah,
    'VAC-DEMO-2026-006': recruiterZenah,
    'VAC-DEMO-2026-007': recruiterLady,
    'VAC-DEMO-2026-008': recruiterSarah,
    'VAC-DEMO-2026-009': recruiterSarah,
    'VAC-DEMO-2026-010': recruiterSarah,
    // R5 (rules pack): a vacancy's primaryRecruiter must never hold
    // ADMINISTRATOR, so VAC-DEMO-2026-011 is primarily recruited by Karim
    // (pure RECRUITER, Team B). demo.multi still requested the
    // requisition (VR-DEMO-2026-016) and owns its applications below.
    'VAC-DEMO-2026-011': karimRecruiter,
  };

  const vacMap = {};
  for (const v of vacancySeeds) {
    const vr = reqMap[v.reqCode];
    if (!vr) continue;
    const owner = ownerByVacancy[v.code] ?? recruiterSarah;
    const createdVac = await upsertVacancy(tx, v.id, {
      organizationId: orgId, branchId: v.br.id, positionId: v.pos.id,
      vacancyRequestId: vr.id, vacancyCode: v.code, status: v.status ?? 'Open',
      approvedHeadcount: v.target, joinedHeadcount: 0,
      primaryRecruiterId: owner.id,
      location: v.br.city, openedAt: dateFromNow(-v.days), targetStartDate: dateFromNow(30),
      requiredSkills: requiredSkillsByVacancy[v.code] ?? ['DHA/MOH License', 'Clinical Experience'],
      ...(v.holdUntil ? { holdUntil: v.holdUntil } : { holdUntil: null }),
    });
    vacMap[v.code] = createdVac;
    await tx.vacancyRequest.update({ where: { id: vr.id }, data: { status: 'Converted to Vacancy' } });
  }

  if (vacMap['VAC-DEMO-2026-009']) {
    const held = vacMap['VAC-DEMO-2026-009'];
    const holdHistory = await tx.vacancyStatusHistory.findFirst({ where: { vacancyId: held.id, toStatus: 'On Hold' } });
    if (!holdHistory) {
      await tx.vacancyStatusHistory.create({
        data: {
          id: fixtureId(430), vacancyId: held.id, fromStatus: 'Open', toStatus: 'On Hold',
          reason: 'Budget review', holdUntil: dateFromNow(14), changedById: hiringManagerHassan.id,
        },
      });
    }
  }

  // Closed vacancy (VAC-DEMO-2026-010): opened then closed, with history, so the
  // Closed state is demonstrable alongside Open / On Hold / Filled.
  if (vacMap['VAC-DEMO-2026-010']) {
    const closed = vacMap['VAC-DEMO-2026-010'];
    const closeHistory = await tx.vacancyStatusHistory.findFirst({ where: { vacancyId: closed.id, toStatus: 'Closed' } });
    if (!closeHistory) {
      await tx.vacancyStatusHistory.create({
        data: {
          id: fixtureId(433), vacancyId: closed.id, fromStatus: 'Open', toStatus: 'Closed',
          reason: 'Position no longer needed', changedById: hiringManagerHassan.id,
        },
      });
    }
  }

  let assignmentSeq = 451;
  for (const v of vacancySeeds) {
    const vac = vacMap[v.code];
    if (!vac) continue;
    const owner = ownerByVacancy[v.code] ?? recruiterSarah;
    const existingAssignment = await tx.vacancyAssignment.findFirst({
      where: { vacancyId: vac.id, userId: owner.id, roleCode: 'RECRUITER', assignmentKind: 'PRIMARY', isActive: true },
    });
    if (existingAssignment) {
      await tx.vacancyAssignment.update({
        where: { id: existingAssignment.id },
        data: { isActive: true, assignmentKind: 'PRIMARY', roleCode: 'RECRUITER' },
      });
    } else {
      await tx.vacancyAssignment.create({
        data: {
          id: fixtureId(assignmentSeq), vacancyId: vac.id, userId: owner.id,
          roleCode: 'RECRUITER', assignmentKind: 'PRIMARY', isActive: true,
        },
      });
    }
    const stalePrimaries = await tx.vacancyAssignment.findMany({
      where: { vacancyId: vac.id, assignmentKind: 'PRIMARY', isActive: true, userId: { not: owner.id } },
    });
    for (const row of stalePrimaries) {
      await tx.vacancyAssignment.update({ where: { id: row.id }, data: { isActive: false, assignmentKind: 'FORMER' } });
    }
    assignmentSeq += 1;
  }
  const radVacForSupport = vacMap['VAC-DEMO-2026-002'];
  if (radVacForSupport) {
    const support = await tx.vacancyAssignment.findFirst({
      where: { vacancyId: radVacForSupport.id, userId: recruiterSarah.id, roleCode: 'RECRUITER', assignmentKind: 'SUPPORT', isActive: true },
    });
    if (!support) {
      await tx.vacancyAssignment.create({
        data: {
          id: fixtureId(assignmentSeq), vacancyId: radVacForSupport.id, userId: recruiterSarah.id,
          roleCode: 'RECRUITER', assignmentKind: 'SUPPORT', isActive: true,
        },
      });
    }
  }

  const approverMona = talentManagerMona ?? hiringManagerHassan;
  const approvalSeeds = [
    { id: fixtureId(321), code: 'VR-DEMO-2026-007', status: 'Pending', comment: null, decidedAt: null, assigneeId: approverMona.id },
    { id: fixtureId(322), code: 'VR-DEMO-2026-011', status: 'Pending', comment: null, decidedAt: null, assigneeId: hiringManagerHassan.id },
    { id: fixtureId(323), code: 'VR-DEMO-2026-012', status: 'Changes Requested', comment: 'Please clarify laser equipment certification requirement and shift coverage before approval.', decidedAt: dateFromNow(-1), assigneeId: hiringManagerHassan.id },
    { id: fixtureId(324), code: 'VR-DEMO-2026-013', status: 'Approved', comment: 'Approved. Ready to set the hiring target.', decidedAt: dateFromNow(-2), assigneeId: hiringManagerHassan.id },
  ];
  for (const approval of approvalSeeds) {
    const request = reqMap[approval.code];
    if (!request) continue;
    await tx.vacancyRequestApproval.upsert({
      where: { vacancyRequestId_revision_step: { vacancyRequestId: request.id, revision: 1, step: 1 } },
      update: {
        roleCode: 'HIRING_MANAGER', status: approval.status, comment: approval.comment,
        decidedAt: approval.decidedAt, assigneeUserId: approval.assigneeId,
      },
      create: {
        id: approval.id, vacancyRequestId: request.id, revision: 1, step: 1, roleCode: 'HIRING_MANAGER',
        status: approval.status, comment: approval.comment, decidedAt: approval.decidedAt, assigneeUserId: approval.assigneeId,
      },
    });
  }

  // ── 7. Real Applications ───────────────────────────────────
  const nurseVacId = vacMap['VAC-DEMO-2026-001']?.id ?? fixtureId(401);
  const radVacId = vacMap['VAC-DEMO-2026-002']?.id ?? fixtureId(402);
  const pharmVacId = vacMap['VAC-DEMO-2026-003']?.id ?? fixtureId(403);
  const psychVacId = vacMap['VAC-DEMO-2026-004']?.id ?? fixtureId(404);
  const counsVacId = vacMap['VAC-DEMO-2026-005']?.id ?? fixtureId(405);
  const urolVacId = vacMap['VAC-DEMO-2026-006']?.id ?? fixtureId(406);
  const midwifeVacId = vacMap['VAC-DEMO-2026-007']?.id ?? fixtureId(407);
  const medCoderVacId = vacMap['VAC-DEMO-2026-008']?.id ?? fixtureId(408);
  const demoVacId = vacMap['VAC-DEMO-2026-011']?.id ?? fixtureId(411);

  const appSeeds = [
    // Interview
    { id: fixtureId(501), code: 'APP-100184', email: 'nour.ali@sample.com', vacId: nurseVacId, stage: 'Offer', src: 'LinkedIn' },
    { id: fixtureId(502), code: 'APP-100185', email: 'heba.salah@sample.com', vacId: nurseVacId, stage: 'Interview', src: 'Referral' },
    { id: fixtureId(503), code: 'APP-100186', email: 'ahmed.samir@sample.com', vacId: pharmVacId, stage: 'Interview', src: 'LinkedIn' },
    { id: fixtureId(504), code: 'APP-100187', email: 'sara.ahmed.cand@sample.com', vacId: nurseVacId, stage: 'Interview', src: 'Career Site' },
    { id: fixtureId(505), code: 'APP-100188', email: 'yousef.magdy@sample.com', vacId: radVacId, stage: 'Interview', src: 'Employee Ref' },
    // Screening
    { id: fixtureId(506), code: 'APP-100189', email: 'omar.h.cand@sample.com', vacId: radVacId, stage: 'Screening', src: 'Career Site' },
    { id: fixtureId(507), code: 'APP-100190', email: 'lina.mostafa@sample.com', vacId: nurseVacId, stage: 'Screening', src: 'Career Site' },
    { id: fixtureId(508), code: 'APP-100191', email: 'kareem.fathy@sample.com', vacId: medCoderVacId, stage: 'Screening', src: 'Employee Ref' },
    // New
    { id: fixtureId(509), code: 'APP-100192', email: 'hassan.talaat@sample.com', vacId: pharmVacId, stage: 'Applied', src: 'LinkedIn' },
    { id: fixtureId(510), code: 'APP-100193', email: 'mariam.essam@sample.com', vacId: medCoderVacId, stage: 'Applied', src: 'LinkedIn' },
    // Offer
    { id: fixtureId(511), code: 'APP-100194', email: 'nabil.ahmed@sample.com', vacId: nurseVacId, stage: 'Offer', src: 'Referral' },
    { id: fixtureId(512), code: 'APP-100195', email: 'ahmed.farag@sample.com', vacId: radVacId, stage: 'Offer', src: 'Career Site' },
    { id: fixtureId(513), code: 'APP-100196', email: 'mai.wahba@sample.com', vacId: nurseVacId, stage: 'Offer', src: 'Agency' },
    // Offer Accepted
    { id: fixtureId(514), code: 'APP-100197', email: 'dr.osama.ali@sample.com', vacId: psychVacId, stage: 'Offer', src: 'Direct Search' },
    { id: fixtureId(515), code: 'APP-100198', email: 'christina.beatric@sample.com', vacId: counsVacId, stage: 'Offer', src: 'Referral' },
    { id: fixtureId(516), code: 'APP-100199', email: 'dr.abhimanyu@sample.com', vacId: urolVacId, stage: 'Offer', src: 'LinkedIn' },
    // Hired
    { id: fixtureId(517), code: 'APP-100200', email: 'dr.mozna@sample.com', vacId: pharmVacId, stage: 'Pre-Hire', src: 'Walk-in' },
    { id: fixtureId(518), code: 'APP-100201', email: 'tasabeeh.m@sample.com', vacId: nurseVacId, stage: 'Pre-Hire', src: 'Agency' },
    { id: fixtureId(519), code: 'APP-100202', email: 'dr.sherif@sample.com', vacId: urolVacId, stage: 'Joined', src: 'Headhunt' },
    { id: fixtureId(520), code: 'APP-100203', email: 'salam.arikat@sample.com', vacId: midwifeVacId, stage: 'Joined', src: 'LinkedIn' },
    { id: fixtureId(521), code: 'APP-100204', email: 'hala.midwife@sample.com', vacId: midwifeVacId, stage: 'Screening', src: 'Referral' },
    { id: fixtureId(522), code: 'APP-100205', email: 'huda.pharm@sample.com', vacId: pharmVacId, stage: 'Screening', src: 'Career Site' },
    // Exit stages (were missing: all other 6 stages already had coverage)
    { id: fixtureId(523), code: 'APP-100206', email: 'farida.nabil@sample.com', vacId: nurseVacId, stage: 'Rejected', src: 'Upload' },
    { id: fixtureId(524), code: 'APP-100207', email: 'walid.gamal@sample.com', vacId: pharmVacId, stage: 'Withdrawn', src: 'Upload' },
    // Demo Multi-Role Lead's requisition (VAC-DEMO-2026-011, requested via
    // VR-DEMO-2026-016); the vacancy's primary recruiter is Karim (R5), while
    // demo.multi owns these two applications on it.
    { id: fixtureId(525), code: 'APP-100208', email: 'rania.kamel@sample.com', vacId: demoVacId, stage: 'Applied', src: 'Upload' },
    { id: fixtureId(526), code: 'APP-100209', email: 'tariq.mansour@sample.com', vacId: demoVacId, stage: 'Screening', src: 'Upload' },
  ];

  const sarahOwned = new Set(['APP-100184', 'APP-100185', 'APP-100187', 'APP-100188', 'APP-100190', 'APP-100191', 'APP-100193', 'APP-100194', 'APP-100195', 'APP-100196', 'APP-100197', 'APP-100201']);
  const demoMultiOwned = new Set(['APP-100208', 'APP-100209']);
  const appMap = {};
  for (const a of appSeeds) {
    const cand = cByEmail[a.email];
    if (!cand) continue;
    let owner = recruiterSarah;
    if (demoMultiOwned.has(a.code)) owner = demoMulti;
    else if (!sarahOwned.has(a.code)) {
      if (a.vacId === radVacId || a.vacId === pharmVacId) owner = recruiterSindu;
      else if (a.vacId === psychVacId || a.vacId === counsVacId || a.vacId === urolVacId) owner = recruiterZenah;
      else if (a.vacId === midwifeVacId) owner = recruiterLady;
    }
    const createdApp = await upsertApplication(tx, a.id, {
      organizationId: orgId, candidateId: cand.id, vacancyId: a.vacId,
      applicationCode: a.code, stage: a.stage, source: a.src,
      primaryRecruiterId: owner.id, taskOwnerId: owner.id,
      appliedAt: dateFromNow(-40),
    });
    appMap[a.code] = createdApp;
  }

  // Rejected applications carry a master-data reason (B5: the Rejected exit
  // is Rejected + a reason from 'rejection-reasons').
  if (appMap['APP-100206']) {
    await tx.application.update({ where: { id: appMap['APP-100206'].id }, data: { rejectionReason: 'Did not pass screening' } });
  }

  // ── 8. Real Interview + Scorecard ──────────────────────────
  const nourAppId = appMap['APP-100184']?.id ?? fixtureId(501);
  const interviewNour = await upsertInterview(tx, fixtureId(601), {
    organizationId: orgId, applicationId: nourAppId,
    interviewCode: 'INT-300789', title: 'Clinical Interview - Registered Nurse',
    interviewType: 'Video',
    scheduledStart: dateFromNow(2),
    scheduledEnd: new Date(dateFromNow(2).getTime() + 60 * 60 * 1000),
    timezone: 'Asia/Dubai', locationUrl: 'https://meet.sgh.ae/123-456-789',
    status: 'Scheduled',
  });

  await tx.interviewAttendee.upsert({
    where: { interviewId_userId: { interviewId: interviewNour.id, userId: hiringManagerOmarH.id } },
    update: { role: 'Hiring Manager' },
    create: { id: fixtureId(651), interviewId: interviewNour.id, userId: hiringManagerOmarH.id, role: 'Hiring Manager' },
  });

  await tx.interviewAttendee.upsert({
    where: { interviewId_userId: { interviewId: interviewNour.id, userId: recruiterSarah.id } },
    update: { role: 'Lead Recruiter' },
    create: { id: fixtureId(652), interviewId: interviewNour.id, userId: recruiterSarah.id, role: 'Lead Recruiter' },
  });

  await tx.interviewScorecard.upsert({
    where: { interviewId_interviewerId_revision: { interviewId: interviewNour.id, interviewerId: hiringManagerOmarH.id, revision: 1 } },
    update: { overallRating: 5, recommendation: 'Strong Hire', status: 'Submitted', submittedAt: dateFromNow(-4) },
    create: {
      id: fixtureId(701),
      interviewId: interviewNour.id, interviewerId: hiringManagerOmarH.id,
      overallRating: 5, recommendation: 'Strong Hire', status: 'Submitted', submittedAt: dateFromNow(-4),
      strengths: 'Excellent clinical judgment in emergency scenarios, compassionate patient communication, familiarity with Epic and Cerner EMR systems.',
      concerns: 'Needs orientation on automated medication dispensing units used in SGH Dubai ICU wing.',
      notes: 'Demonstrates strong clinical knowledge and confidence in patient assessment. Communication: 4/5, Clinical Knowledge: 5/5, Problem Solving: 4/5, Teamwork: 5/5, Professionalism: 5/5, Cultural Fit: 4/5. Average: 4.5/5.0',
    },
  });

  // ── 9. Real Offer + Approval Chain ─────────────────────────
  const offerNour = await upsertOffer(tx, fixtureId(801), {
    organizationId: orgId, applicationId: nourAppId,
    offerCode: 'OFF-2026-0142', status: 'Sent',
  });

  const offerV1 = await upsertOfferVersion(tx, fixtureId(821), {
    offerId: offerNour.id, versionNumber: 1,
    annualFixed: 119000, monthlyPackage: 9916.67,
    contractType: 'Full-time', probationPeriod: '90 days',
    offerExpiry: dateFromNow(7), proposedJoiningDate: dateFromNow(20),
    workLocation: 'SGH Dubai Hospital - ICU Wing',
    workingSchedule: '48 hrs/week (Rotational Shifts)',
    approvalStatus: 'Approved', status: 'Sent',
    sentAt: new Date(), sentChannel: 'email', sentById: recruiterSarah.id,
  });
  await tx.offer.update({ where: { id: offerNour.id }, data: { currentVersionId: offerV1.id } });

  // Offer Components
  const compDefs = [
    { id: fixtureId(831), type: 'Salary', name: 'Base Salary (Annual)', amount: 96000 },
    { id: fixtureId(832), type: 'Allowance', name: 'Housing Allowance', amount: 12000 },
    { id: fixtureId(833), type: 'Allowance', name: 'Transportation', amount: 6000 },
    { id: fixtureId(834), type: 'Benefit', name: 'Performance Bonus', amount: 5000 },
  ];
  for (const c of compDefs) {
    await tx.offerComponent.upsert({
      where: { id: c.id },
      update: { name: c.name, amount: c.amount },
      create: { id: c.id, offerVersionId: offerV1.id, type: c.type, name: c.name, amount: c.amount, currency: 'SAR', frequency: 'Annual' },
    });
  }

  // Offer Approvals
  const apprvDefs = [
    { id: fixtureId(851), user: admin, role: 'HR_MANAGER', status: 'Approved', days: -3, comment: 'Aligned with Nursing Grade 4 band.' },
    { id: fixtureId(852), user: hiringManagerOmarH, role: 'HIRING_MANAGER', status: 'Approved', days: -3, comment: 'Strong clinical fit for ICU Wing 3.' },
    { id: fixtureId(853), user: financeYousef, role: 'FINANCE', status: 'Approved', days: -2, comment: 'Budget cleared FY2026.' },
    { id: fixtureId(854), user: legalHeba, role: 'LEGAL', status: 'Approved', days: -1, comment: 'License verification complete.' },
  ];
  for (const a of apprvDefs) {
    await tx.offerApproval.upsert({
      where: { id: a.id },
      update: { status: a.status, comment: a.comment, decidedAt: a.days != null ? dateFromNow(a.days) : null },
      create: { id: a.id, offerVersionId: offerV1.id, approverUserId: a.user.id, roleCode: a.role, status: a.status, decidedAt: a.days != null ? dateFromNow(a.days) : null, comment: a.comment },
    });
  }

  const appId = (code) => {
    const row = appMap[code];
    if (!row) throw new Error(`Demo application ${code} was not seeded`);
    return row.id;
  };
  const monaId = approverMona.id;

  async function ensureAttendee(id, interviewId, userId, role) {
    await tx.interviewAttendee.upsert({
      where: { interviewId_userId: { interviewId, userId } },
      update: { role },
      create: { id, interviewId, userId, role },
    });
  }

  async function ensureScorecard(id, interviewId, interviewerId, rating, recommendation, notes) {
    await tx.interviewScorecard.upsert({
      where: { interviewId_interviewerId_revision: { interviewId, interviewerId, revision: 1 } },
      update: { overallRating: rating, recommendation, status: 'Submitted', submittedAt: dateFromNow(-1), notes },
      create: {
        id, interviewId, interviewerId, overallRating: rating, recommendation,
        status: 'Submitted', submittedAt: dateFromNow(-1), notes,
        strengths: notes,
      },
    });
  }

  const hebaStart = hoursFromNow(2);
  const interviewHeba = await upsertInterview(tx, fixtureId(602), {
    organizationId: orgId, applicationId: appId('APP-100185'),
    interviewCode: 'INT-300790', title: 'Clinical Interview - Heba Salah',
    interviewType: 'Video', scheduledStart: hebaStart, scheduledEnd: new Date(hebaStart.getTime() + 60 * 60 * 1000),
    timezone: 'Asia/Dubai', locationUrl: 'https://meet.sgh.ae/icu-heba-2026', roomName: null, status: 'Scheduled',
  });
  await ensureAttendee(fixtureId(653), interviewHeba.id, recruiterSarah.id, 'Lead Recruiter');
  await ensureAttendee(fixtureId(654), interviewHeba.id, monaId, 'Hiring Manager');

  // Draft scorecard (not yet submitted) on the pending Heba interview —
  // the Submitted scorecards already exist on the Nour/Sara/Yousef
  // interviews, but no Draft one did.
  await tx.interviewScorecard.upsert({
    where: { interviewId_interviewerId_revision: { interviewId: interviewHeba.id, interviewerId: monaId, revision: 1 } },
    update: { overallRating: 4, recommendation: 'Hire', status: 'Draft', submittedAt: null, notes: 'Draft — strong ICU judgment; confirm on-call availability before submitting.', strengths: 'Strong ICU judgment.' },
    create: { id: fixtureId(705), interviewId: interviewHeba.id, interviewerId: monaId, overallRating: 4, recommendation: 'Hire', status: 'Draft', submittedAt: null, notes: 'Draft — strong ICU judgment; confirm on-call availability before submitting.', strengths: 'Strong ICU judgment.' },
  });

  const saraStart = dateFromNow(-2);
  const interviewSara = await upsertInterview(tx, fixtureId(603), {
    organizationId: orgId, applicationId: appId('APP-100187'),
    interviewCode: 'INT-300791', title: 'Clinical Interview - Sara Ahmed',
    interviewType: 'In-person', scheduledStart: saraStart, scheduledEnd: new Date(saraStart.getTime() + 60 * 60 * 1000),
    timezone: 'Asia/Dubai', locationUrl: null, roomName: 'SGH Dubai Hospital - Nursing Wing Room 2A', status: 'Completed',
  });
  await ensureAttendee(fixtureId(655), interviewSara.id, recruiterSarah.id, 'Lead Recruiter');
  await ensureAttendee(fixtureId(656), interviewSara.id, hiringManagerHassan.id, 'Hiring Manager');
  await ensureScorecard(fixtureId(702), interviewSara.id, hiringManagerHassan.id, 4, 'Hire', 'Solid ICU judgment. Hire.');

  const yousefStart = dateFromNow(-3);
  const interviewYousef = await upsertInterview(tx, fixtureId(604), {
    organizationId: orgId, applicationId: appId('APP-100188'),
    interviewCode: 'INT-300792', title: 'Clinical Interview - Yousef Magdy',
    interviewType: 'In-person', scheduledStart: yousefStart, scheduledEnd: new Date(yousefStart.getTime() + 60 * 60 * 1000),
    timezone: 'Asia/Dubai', locationUrl: null, roomName: 'SGH Dubai Hospital - Radiology Suite 1', status: 'Completed',
  });
  await ensureAttendee(fixtureId(657), interviewYousef.id, recruiterSarah.id, 'Lead Recruiter');
  await ensureAttendee(fixtureId(658), interviewYousef.id, hiringManagerHassan.id, 'Hiring Manager');
  await ensureScorecard(fixtureId(703), interviewYousef.id, recruiterSarah.id, 5, 'Strong Hire', 'Strong imaging judgment. Strong Hire.');
  await ensureScorecard(fixtureId(704), interviewYousef.id, hiringManagerHassan.id, 5, 'Strong Hire', 'Ready to move to offer. Strong Hire.');

  const samirStart = dateFromNow(6);
  const interviewSamir = await upsertInterview(tx, fixtureId(605), {
    organizationId: orgId, applicationId: appId('APP-100186'),
    interviewCode: 'INT-300793', title: 'Pharmacy Interview - Ahmed Samir',
    interviewType: 'Video', scheduledStart: samirStart, scheduledEnd: new Date(samirStart.getTime() + 60 * 60 * 1000),
    timezone: 'Asia/Dubai', locationUrl: 'https://meet.sgh.ae/pharm-samir-2026', roomName: null, status: 'Scheduled',
  });
  await ensureAttendee(fixtureId(659), interviewSamir.id, recruiterSarah.id, 'Lead Recruiter');
  await ensureAttendee(fixtureId(660), interviewSamir.id, recruiterSindu.id, 'Recruiter');

  async function ensureSimpleOffer(id, versionId, componentId, spec) {
    const offer = await upsertOffer(tx, id, {
      organizationId: orgId, applicationId: spec.applicationId, offerCode: spec.offerCode, status: spec.status,
    });
    const version = await upsertOfferVersion(tx, versionId, {
      offerId: offer.id, versionNumber: 1,
      monthlyPackage: spec.monthly, annualFixed: spec.monthly * 12,
      contractType: 'Full-time', probationPeriod: '90 days',
      offerExpiry: dateFromNow(14), proposedJoiningDate: dateFromNow(30),
      workLocation: spec.workLocation, workingSchedule: '48 hrs/week',
      approvalStatus: spec.approvalStatus, status: spec.versionStatus,
      ...(spec.sentAt ? { sentAt: spec.sentAt, sentChannel: 'email', sentById: recruiterSarah.id } : { sentAt: null, sentChannel: null, sentById: null }),
    });
    await tx.offer.update({ where: { id: offer.id }, data: { currentVersionId: version.id, status: spec.status } });
    await tx.offerComponent.upsert({
      where: { id: componentId },
      update: { offerVersionId: version.id, type: 'Salary', name: 'Base Salary', amount: spec.monthly, currency: 'AED', frequency: 'Monthly', isTaxable: true },
      create: { id: componentId, offerVersionId: version.id, type: 'Salary', name: 'Base Salary', amount: spec.monthly, currency: 'AED', frequency: 'Monthly', isTaxable: true },
    });
    return { offer, version };
  }

  const sentNow = new Date();
  await ensureSimpleOffer(fixtureId(802), fixtureId(822), fixtureId(835), {
    applicationId: appId('APP-100194'), offerCode: 'OFF-2026-0141', status: 'Draft',
    approvalStatus: 'Draft', versionStatus: 'Draft', monthly: 11500, workLocation: 'SGH Dubai Hospital - ICU Wing',
  });
  const faragOffer = await ensureSimpleOffer(fixtureId(803), fixtureId(823), fixtureId(836), {
    applicationId: appId('APP-100195'), offerCode: 'OFF-2026-0143', status: 'Pending Approval',
    approvalStatus: 'Pending', versionStatus: 'Pending Approval', monthly: 14500, workLocation: 'SGH Dubai Hospital - Radiology',
  });
  const maiOffer = await ensureSimpleOffer(fixtureId(804), fixtureId(824), fixtureId(837), {
    applicationId: appId('APP-100196'), offerCode: 'OFF-2026-0144', status: 'Changes Requested',
    approvalStatus: 'Changes Requested', versionStatus: 'Changes Requested', monthly: 13000, workLocation: 'SGH Dubai Hospital - ICU Wing',
  });
  await ensureSimpleOffer(fixtureId(805), fixtureId(825), fixtureId(838), {
    applicationId: appId('APP-100197'), offerCode: 'OFF-2026-0145', status: 'Accepted',
    approvalStatus: 'Approved', versionStatus: 'Accepted', monthly: 16000, sentAt: sentNow, workLocation: 'SGH Mental Health - Psychiatry',
  });
  const moznaOffer = await ensureSimpleOffer(fixtureId(806), fixtureId(826), fixtureId(839), {
    applicationId: appId('APP-100200'), offerCode: 'OFF-2026-0146', status: 'Accepted',
    approvalStatus: 'Approved', versionStatus: 'Accepted', monthly: 14000, sentAt: sentNow, workLocation: 'SGH Ajman - Pharmacy',
  });
  const tasabeehOffer = await ensureSimpleOffer(fixtureId(807), fixtureId(827), fixtureId(840), {
    applicationId: appId('APP-100201'), offerCode: 'OFF-2026-0147', status: 'Accepted',
    approvalStatus: 'Approved', versionStatus: 'Accepted', monthly: 15000, sentAt: sentNow, workLocation: 'SGH Dubai Hospital - ICU Wing',
  });
  const sherifOffer = await ensureSimpleOffer(fixtureId(808), fixtureId(828), fixtureId(841), {
    applicationId: appId('APP-100202'), offerCode: 'OFF-2026-0148', status: 'Accepted',
    approvalStatus: 'Approved', versionStatus: 'Accepted', monthly: 22000, sentAt: sentNow, workLocation: 'SGH Dubai Hospital - Urology',
  });
  const salamOffer = await ensureSimpleOffer(fixtureId(809), fixtureId(829), fixtureId(842), {
    applicationId: appId('APP-100203'), offerCode: 'OFF-2026-0149', status: 'Accepted',
    approvalStatus: 'Approved', versionStatus: 'Accepted', monthly: 13000, sentAt: sentNow, workLocation: 'SGH Ajman - Labor & Delivery',
  });
  // Approved-but-unsent offer (the Draft / Pending Approval / Changes
  // Requested / Sent / Accepted states already had coverage; Approved did not).
  const christinaOffer = await ensureSimpleOffer(fixtureId(810), fixtureId(830), fixtureId(843), {
    applicationId: appId('APP-100198'), offerCode: 'OFF-2026-0150', status: 'Approved',
    approvalStatus: 'Approved', versionStatus: 'Approved', monthly: 15500, workLocation: 'SGH Mental Health - Counseling',
  });
  await tx.offerApproval.upsert({
    where: { id: fixtureId(857) },
    update: { offerVersionId: christinaOffer.version.id, approverUserId: monaId, roleCode: 'OFFER_APPROVER', status: 'Approved', comment: 'Within Grade 6 band; approved to send.', decidedAt: dateFromNow(-1) },
    create: { id: fixtureId(857), offerVersionId: christinaOffer.version.id, approverUserId: monaId, roleCode: 'OFFER_APPROVER', status: 'Approved', comment: 'Within Grade 6 band; approved to send.', decidedAt: dateFromNow(-1) },
  });

  await tx.offerApproval.upsert({
    where: { id: fixtureId(855) },
    update: { offerVersionId: faragOffer.version.id, approverUserId: monaId, roleCode: 'OFFER_APPROVER', status: 'Pending', comment: null, decidedAt: null },
    create: { id: fixtureId(855), offerVersionId: faragOffer.version.id, approverUserId: monaId, roleCode: 'OFFER_APPROVER', status: 'Pending' },
  });
  await tx.offerApproval.upsert({
    where: { id: fixtureId(856) },
    update: {
      offerVersionId: maiOffer.version.id, approverUserId: monaId, roleCode: 'OFFER_APPROVER', status: 'Changes Requested',
      comment: 'Adjust housing allowance to match Grade 6 Dubai nursing band.', decidedAt: dateFromNow(-1),
    },
    create: {
      id: fixtureId(856), offerVersionId: maiOffer.version.id, approverUserId: monaId, roleCode: 'OFFER_APPROVER', status: 'Changes Requested',
      comment: 'Adjust housing allowance to match Grade 6 Dubai nursing band.', decidedAt: dateFromNow(-1),
    },
  });

  function joinDate(daysAgo) {
    const proposed = dateFromNow(-daysAgo);
    const cairoMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(new Date());
    const proposedMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(proposed);
    return proposedMonth === cairoMonth ? proposed : new Date();
  }

  async function ensureHiringCase(id, data) {
    const existing = await tx.hiringCase.findUnique({ where: { applicationId: data.applicationId } });
    if (existing) return tx.hiringCase.update({ where: { id: existing.id }, data });
    const byId = await tx.hiringCase.findUnique({ where: { id } });
    if (byId) return tx.hiringCase.update({ where: { id }, data });
    return tx.hiringCase.create({ data: { id, ...data } });
  }

  async function ensureCompliance(id, hiringCaseId, row) {
    const existing = await tx.complianceRequirement.findFirst({ where: { hiringCaseId, name: row.name } });
    const data = { ...row, ...(row.status === 'Verified' ? { verifiedAt: new Date(), verifiedById: recruiterSarah.id } : { verifiedAt: null, verifiedById: null }) };
    if (existing) return tx.complianceRequirement.update({ where: { id: existing.id }, data });
    return tx.complianceRequirement.create({ data: { id, hiringCaseId, ...data } });
  }

  const clinicalSnapshot = { profile: 'clinical', checks: ['ID', 'CONTRACT', 'SCFHS_LICENCE'] };
  const moznaCase = await ensureHiringCase(fixtureId(860), {
    organizationId: orgId, applicationId: appId('APP-100200'), offerId: moznaOffer.offer.id,
    status: 'In Progress', ownerUserId: recruiterSindu.id, plannedJoiningDate: dateFromNow(21), requirementSnapshot: clinicalSnapshot,
  });
  await ensureCompliance(fixtureId(870), moznaCase.id, { type: 'License', name: 'DHA/MOH Medical License', status: 'Verified', isRequired: true });
  await ensureCompliance(fixtureId(871), moznaCase.id, { type: 'Check', name: 'Medical Fitness Check', status: 'Pending', isRequired: true });
  await ensureCompliance(fixtureId(872), moznaCase.id, { type: 'Check', name: 'Credential Primary Source Verification', status: 'Pending', isRequired: true });

  const tasabeehCase = await ensureHiringCase(fixtureId(861), {
    organizationId: orgId, applicationId: appId('APP-100201'), offerId: tasabeehOffer.offer.id,
    status: 'Pending Final Approval', ownerUserId: recruiterSarah.id, plannedJoiningDate: dateFromNow(14), requirementSnapshot: clinicalSnapshot,
  });
  await ensureCompliance(fixtureId(873), tasabeehCase.id, { type: 'License', name: 'DHA/MOH Medical License', status: 'Verified', isRequired: true });
  await ensureCompliance(fixtureId(874), tasabeehCase.id, { type: 'Check', name: 'Medical Fitness Check', status: 'Verified', isRequired: true });
  await ensureCompliance(fixtureId(875), tasabeehCase.id, { type: 'Check', name: 'Credential Primary Source Verification', status: 'Verified', isRequired: true });
  // Pre-hire SCFHS license check: still Pending on the in-progress Mozna
  // case, Verified on the Tasabeeh case awaiting final approval.
  await ensureCompliance(fixtureId(878), moznaCase.id, { type: 'License', name: 'SCFHS License Verification', status: 'Pending', isRequired: true });
  await ensureCompliance(fixtureId(879), tasabeehCase.id, { type: 'License', name: 'SCFHS License Verification', status: 'Verified', isRequired: true });
  const tasabeehApproval = await tx.hiringCaseApproval.findFirst({ where: { hiringCaseId: tasabeehCase.id, roleCode: 'FINAL_HIRING_APPROVER' } });
  if (tasabeehApproval) {
    await tx.hiringCaseApproval.update({
      where: { id: tasabeehApproval.id },
      data: { status: 'Pending', approverUserId: monaId, comment: null, decidedAt: null, decisionFingerprint: null, invalidatedAt: null },
    });
  } else {
    await tx.hiringCaseApproval.create({
      data: { id: fixtureId(890), hiringCaseId: tasabeehCase.id, roleCode: 'FINAL_HIRING_APPROVER', approverUserId: monaId, status: 'Pending' },
    });
  }

  const sherifJoined = joinDate(3);
  const salamJoined = joinDate(6);
  const sherifCase = await ensureHiringCase(fixtureId(862), {
    organizationId: orgId, applicationId: appId('APP-100202'), offerId: sherifOffer.offer.id,
    status: 'Joined', ownerUserId: recruiterZenah.id, actualJoiningDate: sherifJoined, requirementSnapshot: clinicalSnapshot,
  });
  const salamCase = await ensureHiringCase(fixtureId(863), {
    organizationId: orgId, applicationId: appId('APP-100203'), offerId: salamOffer.offer.id,
    status: 'Joined', ownerUserId: recruiterLady.id, actualJoiningDate: salamJoined, requirementSnapshot: clinicalSnapshot,
  });
  await ensureCompliance(fixtureId(876), sherifCase.id, { type: 'License', name: 'DHA/MOH Medical License', status: 'Verified', isRequired: true });
  await ensureCompliance(fixtureId(877), salamCase.id, { type: 'License', name: 'DHA/MOH Medical License', status: 'Verified', isRequired: true });

  async function ensureStage(applicationId, fromStage, toStage, createdAt, changedById) {
    const existing = await tx.applicationStatusHistory.findFirst({ where: { applicationId, fromStage, toStage } });
    if (existing) return;
    await tx.applicationStatusHistory.create({
      data: { applicationId, fromStage, toStage, createdAt, changedById, reason: `Moved to ${toStage}` },
    });
  }
  for (const joined of [
    { code: 'APP-100202', at: sherifJoined, ownerId: recruiterZenah.id },
    { code: 'APP-100203', at: salamJoined, ownerId: recruiterLady.id },
  ]) {
    const id = appId(joined.code);
    await ensureStage(id, null, 'Applied', dateFromNow(-40), joined.ownerId);
    await ensureStage(id, 'Applied', 'Screening', dateFromNow(-30), joined.ownerId);
    await ensureStage(id, 'Screening', 'Interview', dateFromNow(-20), joined.ownerId);
    await ensureStage(id, 'Interview', 'Offer', dateFromNow(-12), joined.ownerId);
    await ensureStage(id, 'Offer', 'Pre-Hire', dateFromNow(-8), joined.ownerId);
    await ensureStage(id, 'Pre-Hire', 'Joined', joined.at, joined.ownerId);
  }

  // Exit-stage history for the Rejected / Withdrawn applications (reopen testing).
  await ensureStage(appId('APP-100206'), null, 'Applied', dateFromNow(-40), recruiterSarah.id);
  await ensureStage(appId('APP-100206'), 'Applied', 'Screening', dateFromNow(-25), recruiterSarah.id);
  await ensureStage(appId('APP-100206'), 'Screening', 'Rejected', dateFromNow(-10), recruiterSarah.id);
  await ensureStage(appId('APP-100207'), null, 'Applied', dateFromNow(-40), recruiterSindu.id);
  await ensureStage(appId('APP-100207'), 'Applied', 'Withdrawn', dateFromNow(-5), recruiterSindu.id);

  await tx.vacancy.update({ where: { id: urolVacId }, data: { joinedHeadcount: 1, status: 'Filled' } });
  await tx.vacancy.update({ where: { id: midwifeVacId }, data: { joinedHeadcount: 1, status: 'Partially Filled' } });
  if (!(await tx.vacancyStatusHistory.findFirst({ where: { vacancyId: urolVacId, toStatus: 'Filled' } }))) {
    await tx.vacancyStatusHistory.create({
      data: { id: fixtureId(431), vacancyId: urolVacId, fromStatus: 'Open', toStatus: 'Filled', reason: 'Sherif Hidar joined', changedById: hiringManagerHassan.id },
    });
  }
  if (!(await tx.vacancyStatusHistory.findFirst({ where: { vacancyId: midwifeVacId, toStatus: 'Partially Filled' } }))) {
    await tx.vacancyStatusHistory.create({
      data: { id: fixtureId(432), vacancyId: midwifeVacId, fromStatus: 'Open', toStatus: 'Partially Filled', reason: 'Salam Arikat joined', changedById: hiringManagerHassan.id },
    });
  }

  async function ensureScreen(applicationId, screenerId, notes, noticePeriodDays) {
    const existing = await tx.screeningLog.findFirst({ where: { applicationId, screenerId, notes } });
    const data = { outcome: 'Passed', notes, noticePeriodDays, method: 'Phone', screenedAt: new Date() };
    if (existing) {
      await tx.screeningLog.update({ where: { id: existing.id }, data });
      return;
    }
    await tx.screeningLog.create({ data: { organizationId: orgId, applicationId, screenerId, ...data } });
  }
  const icuNote = 'Strong ICU shift readiness; verified DHA eligibility.';
  for (const code of ['APP-100184', 'APP-100185', 'APP-100187', 'APP-100190', 'APP-100194', 'APP-100196', 'APP-100201']) {
    await ensureScreen(appId(code), recruiterSarah.id, icuNote, 30);
  }
  for (const code of ['APP-100186', 'APP-100189', 'APP-100192', 'APP-100200', 'APP-100205']) {
    await ensureScreen(appId(code), recruiterSindu.id, 'Pharmacy screen complete; DHA license confirmed.', 30);
  }
  for (const code of ['APP-100203', 'APP-100204']) {
    await ensureScreen(appId(code), recruiterLady.id, 'Midwifery screen complete; labor and delivery experience confirmed.', 45);
  }

  // ── 9b. Screening Draft (unsaved work) ─────────────────────
  // APP-100191 (Kareem Fathy, Screening) has no submitted screening log
  // yet; Sarah holds an in-progress draft for it.
  await tx.screeningDraft.upsert({
    where: { organizationId_userId_applicationId: { organizationId: orgId, userId: recruiterSarah.id, applicationId: appId('APP-100191') } },
    update: { outcome: 'Passed', notes: 'Draft — strong AD/Networking background; confirm notice period before moving to interview.', noticePeriodDays: 30, method: 'Phone', moveToInterview: true },
    create: { id: fixtureId(960), organizationId: orgId, userId: recruiterSarah.id, applicationId: appId('APP-100191'), outcome: 'Passed', notes: 'Draft — strong AD/Networking background; confirm notice period before moving to interview.', noticePeriodDays: 30, method: 'Phone', moveToInterview: true },
  });

  // ── 10. Real Notifications ─────────────────────────────────
  const notifs = [
    { id: fixtureId(901), title: 'Interview Scheduled', msg: 'Omar Hassan scheduled Clinical Interview for Registered Nurse with Nour Ali on May 12 at 10:00 AM.', type: 'InterviewScheduled' },
    { id: fixtureId(902), title: 'New Application Received', msg: 'Sara Ahmed applied for Registered Nurse position (APP-100187).', type: 'ApplicationReceived' },
    { id: fixtureId(903), title: 'Offer Approved', msg: 'Heba Salah offer for Pharmacist approved by Finance.', type: 'OfferApproved' },
    { id: fixtureId(904), title: 'Candidate Withdrew', msg: 'Application withdrawn for Medical Coder position.', type: 'CandidateWithdrew' },
    { id: fixtureId(905), title: 'Evaluation Submitted', msg: 'Omar Hassan submitted evaluation scorecard (4.5/5.0).', type: 'ScorecardSubmitted' },
    { id: fixtureId(906), title: 'Join Interview Reminder', msg: 'Clinical Interview with Nour Ali starts in 15 minutes.', type: 'InterviewReminder' },
    { id: fixtureId(907), title: 'Document Missing', msg: 'Heba Salah missing: Nursing License Verification.', type: 'ComplianceAlert' },
  ];

  for (const n of notifs) {
    const existingNotif = await tx.notification.findUnique({ where: { id: n.id } });
    if (existingNotif) {
      await tx.notification.update({
        where: { id: n.id },
        data: { title: n.title, message: n.msg },
      });
    } else {
      await tx.notification.create({
        data: {
          id: n.id,
          organizationId: orgId, recipientUserId: admin.id,
          type: n.type, title: n.title, message: n.msg,
        },
      });
    }
  }

  // Notifications for the new demo personas (the §10 loop only notifies admin).
  const personaNotifs = [
    { id: fixtureId(908), recipient: demoMulti, type: 'TaskAssigned', title: 'Task assigned: Review requisition VR-DEMO-2026-016', message: 'Hassan Ali assigned you an approval review for the Specialist Obs/Gyn requisition (VR-DEMO-2026-016).' },
    { id: fixtureId(909), recipient: newEmployee, type: 'PasswordChangeRequired', title: 'Set your RecruitFlow password', message: 'Your administrator created your account. Sign in with your temporary password and set a new password (minimum 10 characters) to continue.' },
  ];
  for (const n of personaNotifs) {
    const existingNotif = await tx.notification.findUnique({ where: { id: n.id } });
    if (existingNotif) {
      await tx.notification.update({ where: { id: n.id }, data: { title: n.title, message: n.message } });
    } else {
      await tx.notification.create({
        data: { id: n.id, organizationId: orgId, recipientUserId: n.recipient.id, type: n.type, title: n.title, message: n.message },
      });
    }
  }

  // ── 10b. Tasks (incl. user-management demo owners) ─────────
  // No tasks were seeded before; these cover ApprovalReview,
  // ComplianceCheck, and OfferReview for the new personas and the
  // approved-but-unsent offer.
  const taskSeeds = [
    { id: fixtureId(961), assignee: demoMulti, creator: hiringManagerHassan, type: 'ApprovalReview', title: 'Review requisition VR-DEMO-2026-016 — Specialist Obs/Gyn', description: 'Approval review for the Obs/Gyn requisition owned by the Demo Multi-Role Lead.', priority: 'High', status: 'Open', entityType: 'VacancyRequest', entityId: reqMap['VR-DEMO-2026-016']?.id ?? null, dueDays: 3 },
    { id: fixtureId(962), assignee: newEmployee, creator: demoMulti, type: 'ComplianceCheck', title: 'Complete SCFHS license verification for Tasabeeh Mustafa', description: 'First task for the new starter; SCFHS check on the hiring case awaiting final approval.', priority: 'Normal', status: 'In Progress', entityType: 'HiringCase', entityId: tasabeehCase.id, dueDays: 5 },
    { id: fixtureId(963), assignee: recruiterSarah, creator: talentManagerMona ?? hiringManagerHassan, type: 'OfferReview', title: 'Send approved offer OFF-2026-0150 to Christina Beatric', description: 'Offer approved within the Grade 6 band; send it to the candidate.', priority: 'Normal', status: 'Open', entityType: 'Offer', entityId: christinaOffer.offer.id, dueDays: 2 },
  ];
  for (const t of taskSeeds) {
    const existingTask = await tx.task.findUnique({ where: { id: t.id } });
    const taskData = { organizationId: orgId, assigneeUserId: t.assignee.id, createdById: t.creator.id, type: t.type, title: t.title, description: t.description, priority: t.priority, status: t.status, entityType: t.entityType, entityId: t.entityId, dueAt: dateFromNow(t.dueDays) };
    if (existingTask) await tx.task.update({ where: { id: t.id }, data: taskData });
    else await tx.task.create({ data: { id: t.id, ...taskData } });
  }

  // ── 10c. Current-Month Recruiter Targets ───────────────────
  // Same dynamic Cairo-month pattern as seedEmployeeActivityTargets in
  // seed.cjs (never a hard-coded month): RecruiterTarget.month is 'YYYY-MM'.
  // EmployeeActivityTarget rows for Sarah/Sindu/Mona/Hassan already exist
  // in seed.cjs; RecruiterTarget rows did not exist at all.
  const targetMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(new Date());
  const recruiterTargetSeeds = [
    { recruiter: recruiterSarah, screenings: 20, interviews: 8, offers: 3, hires: 2, cvSourced: 10 },
    { recruiter: recruiterSindu, screenings: 15, interviews: 6, offers: 2, hires: 1, cvSourced: 8 },
    { recruiter: demoMulti, screenings: 10, interviews: 5, offers: 2, hires: 1, cvSourced: 5 },
    { recruiter: karimRecruiter, screenings: 12, interviews: 5, offers: 2, hires: 1, cvSourced: 6 },
    { recruiter: newEmployee, screenings: 5, interviews: 2, offers: 1, hires: 0, cvSourced: 4 },
  ];
  for (const t of recruiterTargetSeeds) {
    await tx.recruiterTarget.upsert({
      where: { organizationId_recruiterId_period_month: { organizationId: orgId, recruiterId: t.recruiter.id, period: 'monthly', month: targetMonth } },
      update: { screenings: t.screenings, interviews: t.interviews, offers: t.offers, hires: t.hires, cvSourced: t.cvSourced, isActive: true },
      create: { organizationId: orgId, recruiterId: t.recruiter.id, setById: hiringManagerHassan.id, period: 'monthly', month: targetMonth, calls: 0, screenings: t.screenings, interviews: t.interviews, offers: t.offers, hires: t.hires, cvSourced: t.cvSourced, isActive: true },
    });
  }

  // ── 11. Real Talent Pools ──────────────────────────────────
  await tx.talentPool.upsert({
    where: { id: fixtureId(951) },
    update: { name: 'Critical Care Nurses & Midwives', tags: ['Nursing', 'ICU', 'Midwifery', 'DHA'] },
    create: { id: fixtureId(951), organizationId: orgId, name: 'Critical Care Nurses & Midwives', description: 'ICU, NICU, Emergency, and LDU rapid-deployment pool.', tags: ['Nursing', 'ICU', 'Midwifery', 'DHA'], status: 'Active' },
  });
  await tx.talentPool.upsert({
    where: { id: fixtureId(952) },
    update: { name: 'Consultant & Specialist Physicians', tags: ['Physicians', 'Consultants'] },
    create: { id: fixtureId(952), organizationId: orgId, name: 'Consultant & Specialist Physicians', description: 'Cardiology, Urology, Psychiatry, Dermatology physicians.', tags: ['Physicians', 'Consultants'], status: 'Active' },
  });
  await tx.talentPool.upsert({
    where: { id: fixtureId(953) },
    update: { name: 'Healthcare IT Specialists', tags: ['IT', 'Medical-Coding'] },
    create: { id: fixtureId(953), organizationId: orgId, name: 'Healthcare IT Specialists', description: 'Medical coders, HIS engineers, cybersecurity.', tags: ['IT', 'Medical-Coding'], status: 'Active' },
  });

  const skillLinks = await linkDemoSkills(tx, orgId);

  return {
    skillLinks,
    candidates: candidateSeeds.length,
    vacancyRequests: requestSeeds.length,
    vacancies: vacancySeeds.length,
    applications: appSeeds.length,
    interviews: 5,
    offers: 10,
    hiringCases: 4,
    notifications: notifs.length + personaNotifs.length,
    talentPools: 3,
    tasks: taskSeeds.length,
    recruiterTargets: recruiterTargetSeeds.length,
    screeningDrafts: 1,
  };
}

module.exports = { seedDemoFixtures };
