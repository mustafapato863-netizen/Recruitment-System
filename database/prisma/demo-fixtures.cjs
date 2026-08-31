const DEMO_PASSWORD_HASH = '$2b$10$1YF2d.BurlPR9CzQravUWuqurUfHyhpGLe5yAW13nWRf7gCC6raDe';
const DAY_MS = 24 * 60 * 60 * 1000;

function fixtureId(number) {
  return `20000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
}

function dateFromNow(days) {
  return new Date(Date.now() + days * DAY_MS);
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

async function upsertBranch(tx, orgId, legalEntityId, id, code, name, city) {
  const existingById = await tx.branch.findUnique({ where: { id } });
  if (existingById) {
    return tx.branch.update({
      where: { id },
      data: { code, name, city, status: 'Active' },
    });
  }
  const existingByCode = await tx.branch.findUnique({
    where: { legalEntityId_code: { legalEntityId, code } },
  });
  if (existingByCode) {
    return tx.branch.update({
      where: { id: existingByCode.id },
      data: { name, city, status: 'Active' },
    });
  }
  return tx.branch.create({
    data: { id, organizationId: orgId, legalEntityId, code, name, city, status: 'Active' },
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
  if (existingByCode) {
    return tx.vacancy.update({
      where: { id: existingByCode.id },
      data,
    });
  }
  const existingByReq = await tx.vacancy.findUnique({
    where: { vacancyRequestId: data.vacancyRequestId },
  });
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

async function seedDemoFixtures(tx, { organization, legalEntity, branch, position, users: seededUsers }) {
  const userRows = await tx.user.findMany({ where: { organizationId: organization.id } });
  const usersByEmail = Object.fromEntries(userRows.map((user) => [user.email, user]));

  // ── 1. Core Users (Real Saudi German Health Team) ───────────
  const admin = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'ahmed.mahmoud@recruitflow.local' } },
    update: { displayName: 'Ahmed Mahmoud (HR Director)', status: 'Active' },
    create: {
      id: fixtureId(150),
      organizationId: organization.id,
      email: 'ahmed.mahmoud@recruitflow.local',
      emailNormalized: 'ahmed.mahmoud@recruitflow.local',
      displayName: 'Ahmed Mahmoud (HR Director)',
      passwordHash: DEMO_PASSWORD_HASH,
      status: 'Active',
    },
  });

  const recruiterSarah = usersByEmail['sarah.ahmed@recruitflow.local'] ?? admin;
  const hiringManagerHassan = usersByEmail['hassan.ali@recruitflow.local'] ?? admin;

  // Additional Real SGH Recruiters from 2026 Vacant List
  const recruiterSindu = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'sindu@recruitflow.local' } },
    update: { displayName: 'Sindu (Senior Recruiter)', status: 'Active' },
    create: { id: fixtureId(151), organizationId: organization.id, email: 'sindu@recruitflow.local', emailNormalized: 'sindu@recruitflow.local', displayName: 'Sindu (Senior Recruiter)', passwordHash: DEMO_PASSWORD_HASH, status: 'Active' },
  });

  const recruiterZenah = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'zenah@recruitflow.local' } },
    update: { displayName: 'Zenah (Recruiter)', status: 'Active' },
    create: { id: fixtureId(152), organizationId: organization.id, email: 'zenah@recruitflow.local', emailNormalized: 'zenah@recruitflow.local', displayName: 'Zenah (Recruiter)', passwordHash: DEMO_PASSWORD_HASH, status: 'Active' },
  });

  const recruiterLady = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'lady@recruitflow.local' } },
    update: { displayName: 'Lady (Nursing Recruiter)', status: 'Active' },
    create: { id: fixtureId(153), organizationId: organization.id, email: 'lady@recruitflow.local', emailNormalized: 'lady@recruitflow.local', displayName: 'Lady (Nursing Recruiter)', passwordHash: DEMO_PASSWORD_HASH, status: 'Active' },
  });

  const hiringManagerOmarH = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'omar.hassan@recruitflow.local' } },
    update: { displayName: 'Omar Hassan (Hiring Mgr)', status: 'Active' },
    create: { id: fixtureId(154), organizationId: organization.id, email: 'omar.hassan@recruitflow.local', emailNormalized: 'omar.hassan@recruitflow.local', displayName: 'Omar Hassan (Hiring Mgr)', passwordHash: DEMO_PASSWORD_HASH, status: 'Active' },
  });

  const financeYousef = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'yousef.hamdy@recruitflow.local' } },
    update: { displayName: 'Yousef Hamdy (Finance)', status: 'Active' },
    create: { id: fixtureId(155), organizationId: organization.id, email: 'yousef.hamdy@recruitflow.local', emailNormalized: 'yousef.hamdy@recruitflow.local', displayName: 'Yousef Hamdy (Finance)', passwordHash: DEMO_PASSWORD_HASH, status: 'Active' },
  });

  const legalHeba = await tx.user.upsert({
    where: { organizationId_emailNormalized: { organizationId: organization.id, emailNormalized: 'heba.salem@recruitflow.local' } },
    update: { displayName: 'Heba Salem (Legal)', status: 'Active' },
    create: { id: fixtureId(156), organizationId: organization.id, email: 'heba.salem@recruitflow.local', emailNormalized: 'heba.salem@recruitflow.local', displayName: 'Heba Salem (Legal)', passwordHash: DEMO_PASSWORD_HASH, status: 'Active' },
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

  // ── 2. Real Branches from 2026 Manpower List ───────────────
  const orgId = organization.id;
  const leId = legalEntity.id;

  const branches = {
    dubai: await upsertBranch(tx, orgId, leId, fixtureId(101), 'DXB-MAIN', 'SGH Dubai Hospital', 'Dubai'),
    ajman: await upsertBranch(tx, orgId, leId, fixtureId(102), 'AJM-HOSP', 'SGH Ajman Hospital', 'Ajman'),
    sharjah: await upsertBranch(tx, orgId, leId, fixtureId(103), 'SHJ-HOSP', 'SGH Sharjah Hospital', 'Sharjah'),
    mentalHealth: await upsertBranch(tx, orgId, leId, fixtureId(104), 'DXB-PSYCH', 'Mental Health Center Dubai', 'Dubai'),
    rak: await upsertBranch(tx, orgId, leId, fixtureId(105), 'RAK-CLINIC', 'SGH Clinic RAK', 'Ras Al Khaimah'),
    alSuyouh: await upsertBranch(tx, orgId, leId, fixtureId(106), 'SUYOUH-CLN', 'SGH Clinic Al Suyouh', 'Sharjah'),
    group: await upsertBranch(tx, orgId, leId, fixtureId(107), 'GRP-HQ', 'SGH Group Corporate Office', 'Dubai'),
  };

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
    { email: 'nour.ali@sample.com', firstName: 'Nour', lastName: 'Ali', phone: '+966501234567', currentTitle: 'Registered Nurse', currentCompany: 'Care Hospital', source: 'LinkedIn', skills: ['ICU', 'BLS/ACLS', 'IV Therapy'], location: 'Riyadh', experienceYears: 5 },
    { email: 'heba.salah@sample.com', firstName: 'Heba', lastName: 'Salah', phone: '+966549876543', currentTitle: 'Registered Nurse (ICU)', currentCompany: 'King Faisal Hospital', source: 'Referral', skills: ['ICU', 'Wound Care'], location: 'Riyadh', experienceYears: 4 },
    { email: 'lina.mostafa@sample.com', firstName: 'Lina', lastName: 'Mostafa', phone: '+966554321098', currentTitle: 'Registered Nurse (Peds)', currentCompany: 'SGH Cairo', source: 'Career Site', skills: ['Pediatrics', 'BLS'], location: 'Jeddah', experienceYears: 3 },
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
    { email: 'sara.ahmed.cand@sample.com', firstName: 'Sara', lastName: 'Ahmed', phone: '+966541113355', currentTitle: 'Staff Nurse', currentCompany: 'Saudi German Hospital', source: 'Career Site', skills: ['Critical Care', 'BLS/ACLS'], location: 'Riyadh', experienceYears: 4 },
    { email: 'nabil.ahmed@sample.com', firstName: 'Nabil', lastName: 'Ahmed', phone: '+966553335577', currentTitle: 'Senior Registered Nurse', currentCompany: 'Aster Clinic', source: 'Referral', skills: ['Emergency Care', 'Triage', 'ACLS'], location: 'Dubai', experienceYears: 8 },
  ];

  for (let i = 0; i < candidateSeeds.length; i++) {
    const c = candidateSeeds[i];
    await upsertCandidate(tx, orgId, fixtureId(200 + i), {
      candidateCode: `CND-SGH-${String(i + 1).padStart(3, '0')}`,
      firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone,
      currentTitle: c.currentTitle, currentCompany: c.currentCompany, source: c.source,
      skills: c.skills, location: c.location, experienceYears: c.experienceYears,
    });
  }

  const candidateRows = await tx.candidate.findMany({ where: { organizationId: orgId } });
  const cByEmail = Object.fromEntries(candidateRows.map((c) => [c.email, c]));

  // ── 4b. Real CV Documents for CV Bank ─────────────────────
  for (let i = 0; i < candidateSeeds.length; i++) {
    const c = candidateSeeds[i];
    const cand = cByEmail[c.email];
    if (!cand) continue;
    const existingDoc = await tx.candidateDocument.findFirst({
      where: { organizationId: orgId, candidateId: cand.id, documentType: 'CV' },
    });
    if (existingDoc) {
      await tx.candidateDocument.update({
        where: { id: existingDoc.id },
        data: {
          fileName: `${c.firstName}_${c.lastName}_Resume_2026.pdf`,
          fileSize: 1024 * (120 + i * 15),
          mimeType: 'application/pdf',
          storageKey: `cvs/${orgId}/${cand.id}/resume.pdf`,
          storageProvider: 'local-private',
          scanStatus: 'Clean',
          consentStatus: 'Active',
          retentionExpiresAt: dateFromNow(365),
        },
      });
    } else {
      await tx.candidateDocument.create({
        data: {
          id: fixtureId(250 + i),
          organizationId: orgId,
          candidateId: cand.id,
          documentType: 'CV',
          fileName: `${c.firstName}_${c.lastName}_Resume_2026.pdf`,
          fileSize: 1024 * (120 + i * 15),
          mimeType: 'application/pdf',
          storageKey: `cvs/${orgId}/${cand.id}/resume.pdf`,
          storageProvider: 'local-private',
          scanStatus: 'Clean',
          consentStatus: 'Active',
          retentionExpiresAt: dateFromNow(365),
        },
      });
    }
  }

  // ── 5. Real Vacancy Requisitions ───────────────────────────
  const requestSeeds = [
    { id: fixtureId(301), code: 'VR-2026-001', pos: positions.staffNurse, br: branches.dubai, req: hiringManagerOmarH, status: 'Approved', headcount: 8, empType: 'Full-time', reason: 'ICU Wing 3 Expansion', budget: 'Budgeted', crit: 'Critical', startDays: 15 },
    { id: fixtureId(302), code: 'VR-2026-002', pos: positions.radTech, br: branches.dubai, req: hiringManagerHassan, status: 'Approved', headcount: 3, empType: 'Full-time', reason: 'MRI Suite 24/7 Coverage', budget: 'Budgeted', crit: 'High', startDays: 30 },
    { id: fixtureId(303), code: 'VR-2026-003', pos: positions.pharmacist, br: branches.ajman, req: recruiterSindu, status: 'Approved', headcount: 2, empType: 'Full-time', reason: 'Inpatient Pharmacy Backfill', budget: 'Budgeted', crit: 'Normal', startDays: 35 },
    { id: fixtureId(304), code: 'VR-2026-004', pos: positions.psychiatrist, br: branches.mentalHealth, req: recruiterZenah, status: 'Approved', headcount: 1, empType: 'Full-time', reason: 'Outpatient Psychiatry Expansion', budget: 'Budgeted', crit: 'Critical', startDays: 20 },
    { id: fixtureId(305), code: 'VR-2026-005', pos: positions.counselor, br: branches.mentalHealth, req: recruiterZenah, status: 'Approved', headcount: 1, empType: 'Full-time', reason: 'Child & Adolescent Counseling', budget: 'Budgeted', crit: 'Normal', startDays: 45 },
    { id: fixtureId(306), code: 'VR-2026-006', pos: positions.urologist, br: branches.dubai, req: recruiterZenah, status: 'Approved', headcount: 1, empType: 'Full-time', reason: 'Replacement for Dr. Sherif', budget: 'Budgeted', crit: 'Critical', startDays: 10 },
    { id: fixtureId(307), code: 'VR-2026-007', pos: positions.itSupport, br: branches.group, req: recruiterSindu, status: 'Pending Approval', headcount: 2, empType: 'Full-time', reason: 'HIS Infrastructure Rollout', budget: 'Budgeted', crit: 'Normal', startDays: 40 },
    { id: fixtureId(308), code: 'VR-2026-008', pos: positions.midwife, br: branches.ajman, req: recruiterLady, status: 'Approved', headcount: 2, empType: 'Full-time', reason: 'LDU Shift Coverage', budget: 'Budgeted', crit: 'Critical', startDays: 14 },
    { id: fixtureId(309), code: 'VR-2026-009', pos: positions.medCoder, br: branches.dubai, req: recruiterSarah, status: 'Approved', headcount: 2, empType: 'Full-time', reason: 'Insurance Revenue Cycle', budget: 'Budgeted', crit: 'Normal', startDays: 60 },
    { id: fixtureId(310), code: 'VR-2026-010', pos: positions.hrSpec, br: branches.group, req: admin, status: 'Draft', headcount: 1, empType: 'Full-time', reason: 'Talent Acquisition Team', budget: 'Budgeted', crit: 'Normal', startDays: 90 },
  ];

  const reqMap = {};
  for (const r of requestSeeds) {
    const createdReq = await upsertVacancyRequest(tx, r.id, {
      organizationId: orgId, legalEntityId: leId, branchId: r.br.id, positionId: r.pos.id,
      requesterId: r.req.id, requestCode: r.code, status: r.status,
      requestedHeadcount: r.headcount, employmentType: r.empType, reason: r.reason,
      budgetStatus: r.budget, criticality: r.crit,
      targetStartDate: dateFromNow(r.startDays),
      justification: `${r.reason} - SGH 2026 Healthcare Manpower.`,
      submittedAt: r.status === 'Draft' ? null : dateFromNow(-10),
    });
    reqMap[r.code] = createdReq;
  }

  // ── 6. Real Vacancies ──────────────────────────────────────
  const vacancySeeds = [
    { id: fixtureId(401), code: 'VAC-2026-001', reqCode: 'VR-2026-001', pos: positions.staffNurse, br: branches.dubai, target: 8, days: 45 },
    { id: fixtureId(402), code: 'VAC-2026-002', reqCode: 'VR-2026-002', pos: positions.radTech, br: branches.dubai, target: 3, days: 62 },
    { id: fixtureId(403), code: 'VAC-2026-003', reqCode: 'VR-2026-003', pos: positions.pharmacist, br: branches.ajman, target: 2, days: 35 },
    { id: fixtureId(404), code: 'VAC-2026-004', reqCode: 'VR-2026-004', pos: positions.psychiatrist, br: branches.mentalHealth, target: 1, days: 125 },
    { id: fixtureId(405), code: 'VAC-2026-005', reqCode: 'VR-2026-005', pos: positions.counselor, br: branches.mentalHealth, target: 1, days: 125 },
    { id: fixtureId(406), code: 'VAC-2026-006', reqCode: 'VR-2026-006', pos: positions.urologist, br: branches.dubai, target: 1, days: 106 },
    { id: fixtureId(407), code: 'VAC-2026-007', reqCode: 'VR-2026-008', pos: positions.midwife, br: branches.ajman, target: 2, days: 30 },
    { id: fixtureId(408), code: 'VAC-2026-008', reqCode: 'VR-2026-009', pos: positions.medCoder, br: branches.dubai, target: 2, days: 36 },
  ];

  const vacMap = {};
  for (const v of vacancySeeds) {
    const vr = reqMap[v.reqCode];
    if (!vr) continue;
    const createdVac = await upsertVacancy(tx, v.id, {
      organizationId: orgId, legalEntityId: leId, branchId: v.br.id, positionId: v.pos.id,
      vacancyRequestId: vr.id, vacancyCode: v.code, status: 'Open',
      approvedHeadcount: v.target, joinedHeadcount: 0,
      location: v.br.city, openedAt: dateFromNow(-v.days), targetStartDate: dateFromNow(30),
      requiredSkills: ['DHA/MOH License', 'Clinical Experience'],
    });
    vacMap[v.code] = createdVac;
  }

  // ── 7. Real Applications ───────────────────────────────────
  const nurseVacId = vacMap['VAC-2026-001']?.id ?? fixtureId(401);
  const radVacId = vacMap['VAC-2026-002']?.id ?? fixtureId(402);
  const pharmVacId = vacMap['VAC-2026-003']?.id ?? fixtureId(403);
  const psychVacId = vacMap['VAC-2026-004']?.id ?? fixtureId(404);
  const counsVacId = vacMap['VAC-2026-005']?.id ?? fixtureId(405);
  const urolVacId = vacMap['VAC-2026-006']?.id ?? fixtureId(406);
  const medCoderVacId = vacMap['VAC-2026-008']?.id ?? fixtureId(408);

  const appSeeds = [
    // Interview
    { id: fixtureId(501), code: 'APP-100184', email: 'nour.ali@sample.com', vacId: nurseVacId, stage: 'Interview', src: 'LinkedIn' },
    { id: fixtureId(502), code: 'APP-100185', email: 'heba.salah@sample.com', vacId: nurseVacId, stage: 'Interview', src: 'Referral' },
    { id: fixtureId(503), code: 'APP-100186', email: 'ahmed.samir@sample.com', vacId: pharmVacId, stage: 'Interview', src: 'LinkedIn' },
    { id: fixtureId(504), code: 'APP-100187', email: 'sara.ahmed.cand@sample.com', vacId: nurseVacId, stage: 'Interview', src: 'Career Site' },
    { id: fixtureId(505), code: 'APP-100188', email: 'yousef.magdy@sample.com', vacId: radVacId, stage: 'Interview', src: 'Employee Ref' },
    // Screening
    { id: fixtureId(506), code: 'APP-100189', email: 'omar.h.cand@sample.com', vacId: radVacId, stage: 'Screening', src: 'Career Site' },
    { id: fixtureId(507), code: 'APP-100190', email: 'lina.mostafa@sample.com', vacId: nurseVacId, stage: 'Screening', src: 'Career Site' },
    { id: fixtureId(508), code: 'APP-100191', email: 'kareem.fathy@sample.com', vacId: medCoderVacId, stage: 'Screening', src: 'Employee Ref' },
    // New
    { id: fixtureId(509), code: 'APP-100192', email: 'hassan.talaat@sample.com', vacId: pharmVacId, stage: 'New', src: 'LinkedIn' },
    { id: fixtureId(510), code: 'APP-100193', email: 'mariam.essam@sample.com', vacId: medCoderVacId, stage: 'New', src: 'LinkedIn' },
    // Offer
    { id: fixtureId(511), code: 'APP-100194', email: 'nabil.ahmed@sample.com', vacId: nurseVacId, stage: 'Offer', src: 'Referral' },
    { id: fixtureId(512), code: 'APP-100195', email: 'ahmed.farag@sample.com', vacId: radVacId, stage: 'Offer', src: 'Career Site' },
    { id: fixtureId(513), code: 'APP-100196', email: 'mai.wahba@sample.com', vacId: nurseVacId, stage: 'Offer', src: 'Agency' },
    // Offer Accepted
    { id: fixtureId(514), code: 'APP-100197', email: 'dr.osama.ali@sample.com', vacId: psychVacId, stage: 'Offer', src: 'Direct Search' },
    { id: fixtureId(515), code: 'APP-100198', email: 'christina.beatric@sample.com', vacId: counsVacId, stage: 'Offer', src: 'Referral' },
    { id: fixtureId(516), code: 'APP-100199', email: 'dr.abhimanyu@sample.com', vacId: urolVacId, stage: 'Offer', src: 'LinkedIn' },
    // Hired
    { id: fixtureId(517), code: 'APP-100200', email: 'dr.mozna@sample.com', vacId: pharmVacId, stage: 'Hired', src: 'Walk-in' },
    { id: fixtureId(518), code: 'APP-100201', email: 'tasabeeh.m@sample.com', vacId: nurseVacId, stage: 'Hired', src: 'Agency' },
  ];

  const appMap = {};
  for (const a of appSeeds) {
    const cand = cByEmail[a.email];
    if (!cand) continue;
    const createdApp = await upsertApplication(tx, a.id, {
      organizationId: orgId, candidateId: cand.id, vacancyId: a.vacId,
      applicationCode: a.code, stage: a.stage, source: a.src,
      primaryRecruiterId: recruiterSarah.id, taskOwnerId: recruiterLady.id,
      appliedAt: dateFromNow(-18),
    });
    appMap[a.code] = createdApp;
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
    where: { interviewId_interviewerId: { interviewId: interviewNour.id, interviewerId: hiringManagerOmarH.id } },
    update: { overallRating: 5, recommendation: 'Strong Hire' },
    create: {
      id: fixtureId(701),
      interviewId: interviewNour.id, interviewerId: hiringManagerOmarH.id,
      overallRating: 5, recommendation: 'Strong Hire',
      strengths: 'Excellent clinical judgment in emergency scenarios, compassionate patient communication, familiarity with Epic and Cerner EMR systems.',
      concerns: 'Needs orientation on automated medication dispensing units used in SGH Dubai ICU wing.',
      notes: 'Demonstrates strong clinical knowledge and confidence in patient assessment. Communication: 4/5, Clinical Knowledge: 5/5, Problem Solving: 4/5, Teamwork: 5/5, Professionalism: 5/5, Cultural Fit: 4/5. Average: 4.5/5.0',
    },
  });

  // ── 9. Real Offer + Approval Chain ─────────────────────────
  const offerNour = await upsertOffer(tx, fixtureId(801), {
    organizationId: orgId, applicationId: nourAppId,
    offerCode: 'OFF-2024-0142', status: 'Sent to Candidate',
  });

  const offerV1 = await upsertOfferVersion(tx, fixtureId(821), {
    offerId: offerNour.id, versionNumber: 1,
    annualFixed: 119000, monthlyPackage: 9916.67,
    contractType: 'Full-time', probationPeriod: '90 days',
    offerExpiry: dateFromNow(7), proposedJoiningDate: dateFromNow(20),
    workLocation: 'SGH Dubai Hospital - ICU Wing',
    workingSchedule: '48 hrs/week (Rotational Shifts)',
    approvalStatus: 'Approved', isLocked: true,
  });

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
    { id: fixtureId(854), user: legalHeba, role: 'LEGAL', status: 'Pending', days: null, comment: 'Awaiting license verification.' },
  ];
  for (const a of apprvDefs) {
    await tx.offerApproval.upsert({
      where: { id: a.id },
      update: { status: a.status, comment: a.comment },
      create: { id: a.id, offerVersionId: offerV1.id, approverUserId: a.user.id, roleCode: a.role, status: a.status, decidedAt: a.days ? dateFromNow(a.days) : null, comment: a.comment },
    });
  }

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

  return {
    candidates: candidateSeeds.length,
    vacancyRequests: requestSeeds.length,
    vacancies: vacancySeeds.length,
    applications: appSeeds.length,
    interviews: 1,
    offers: 1,
    notifications: notifs.length,
    talentPools: 3,
  };
}

module.exports = { seedDemoFixtures };
