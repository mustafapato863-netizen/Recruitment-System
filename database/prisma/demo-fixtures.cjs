const DEMO_PASSWORD_HASH = '$2b$10$1YF2d.BurlPR9CzQravUWuqurUfHyhpGLe5yAW13nWRf7gCC6raDe';
const DAY_MS = 24 * 60 * 60 * 1000;

function fixtureId(number) {
  return `20000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
}

function dateFromNow(days) {
  return new Date(Date.now() + days * DAY_MS);
}

async function upsertById(tx, model, id, data, update = data) {
  return tx[model].upsert({
    where: { id },
    update,
    create: { id, ...data },
  });
}

async function seedDemoFixtures(tx, { organization, legalEntity, branch, position, users: seededUsers }) {
  const userRows = await tx.user.findMany({ where: { organizationId: organization.id } });
  const usersByEmail = Object.fromEntries(userRows.map((user) => [user.email, user]));

  const admin = await tx.user.upsert({
    where: {
      organizationId_emailNormalized: {
        organizationId: organization.id,
        emailNormalized: 'super@admin.dev',
      },
    },
    update: {
      displayName: 'Super Admin',
      passwordHash: DEMO_PASSWORD_HASH,
      status: 'Active',
    },
    create: {
      id: fixtureId(150),
      organizationId: organization.id,
      email: 'super@admin.dev',
      emailNormalized: 'super@admin.dev',
      displayName: 'Super Admin',
      passwordHash: DEMO_PASSWORD_HASH,
      status: 'Active',
    },
  });
  usersByEmail[admin.email] = admin;

  const users = {
    admin,
    recruiter: usersByEmail['sarah.ahmed@recruitflow.local'] ?? admin,
    hiringManager: usersByEmail['hassan.ali@recruitflow.local'] ?? admin,
    approver: usersByEmail['aya.mostafa@recruitflow.local'] ?? admin,
    licenseSpecialist: usersByEmail['omar.nasser@recruitflow.local'] ?? admin,
  };

  const administratorRole = await tx.role.findUnique({ where: { code: 'ADMINISTRATOR' } });
  if (administratorRole) {
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: administratorRole.id } },
      update: {},
      create: { userId: admin.id, roleId: administratorRole.id },
    });
  }

  const branches = {
    hq: branch,
    nasrCity: await upsertById(tx, 'branch', fixtureId(101), {
      organizationId: organization.id,
      legalEntityId: legalEntity.id,
      code: 'NASR-CITY',
      name: 'Nasr City Branch',
      city: 'Cairo',
      status: 'Active',
    }),
    alexandria: await upsertById(tx, 'branch', fixtureId(102), {
      organizationId: organization.id,
      legalEntityId: legalEntity.id,
      code: 'ALEXANDRIA',
      name: 'Alexandria Branch',
      city: 'Alexandria',
      status: 'Active',
    }),
  };

  const positionRows = await tx.position.findMany({ where: { organizationId: organization.id } });
  const positionsByCode = Object.fromEntries(positionRows.map((row) => [row.code, row]));
  const positions = {
    seniorEngineer: positionsByCode.SSE ?? position,
    pharmacist: positionsByCode['SR-PHARM'] ?? position,
    frontendEngineer: positionsByCode['FE-ENG'] ?? position,
    hrSpecialist: positionsByCode['HR-SPEC'] ?? position,
    salesExecutive: positionsByCode['SALES-EXEC'] ?? position,
  };

  const candidateSeeds = [
    { email: 'mariam.farouk@example.com', firstName: 'Mariam', lastName: 'Farouk', phone: '+201001234567', currentTitle: 'Lead Frontend Developer', currentCompany: 'TechHub', source: 'LinkedIn' },
    { email: 'kareem.ezzat@example.com', firstName: 'Kareem', lastName: 'Ezzat', phone: '+201119876543', currentTitle: 'Senior React Specialist', currentCompany: 'DevCorp', source: 'Referral' },
    { email: 'nour.salem@example.com', firstName: 'Nour', lastName: 'Salem', phone: '+201225554433', currentTitle: 'UI/UX Designer & Engineer', currentCompany: 'DesignStudio', source: 'Job Portal' },
    { email: 'youssef.adel@example.com', firstName: 'Youssef', lastName: 'Adel', phone: '+201012345678', currentTitle: 'Backend Engineer', currentCompany: 'CloudWorks', source: 'LinkedIn' },
    { email: 'salma.hany@example.com', firstName: 'Salma', lastName: 'Hany', phone: '+201098765432', currentTitle: 'Product Designer', currentCompany: 'Pixel House', source: 'Referral' },
    { email: 'omar.fathy@example.com', firstName: 'Omar', lastName: 'Fathy', phone: '+201155566677', currentTitle: 'Full Stack Engineer', currentCompany: 'BuildLab', source: 'Careers Page' },
    { email: 'jana.samir@example.com', firstName: 'Jana', lastName: 'Samir', phone: '+201188899900', currentTitle: 'HR Business Partner', currentCompany: 'PeopleFirst', source: 'Job Portal' },
    { email: 'mostafa.nabil@example.com', firstName: 'Mostafa', lastName: 'Nabil', phone: '+201101112222', currentTitle: 'Sales Team Lead', currentCompany: 'MarketPro', source: 'Referral' },
    { email: 'dina.tarek@example.com', firstName: 'Dina', lastName: 'Tarek', phone: '+201133344455', currentTitle: 'Pharmacist', currentCompany: 'Care Pharmacy', source: 'Walk-in' },
    { email: 'huda.wael@example.com', firstName: 'Huda', lastName: 'Wael', phone: '+201166677788', currentTitle: 'Frontend Engineer', currentCompany: 'WebStack', source: 'LinkedIn' },
  ];

  for (let index = 0; index < candidateSeeds.length; index += 1) {
    const candidate = candidateSeeds[index];
    await tx.candidate.upsert({
      where: { organizationId_email: { organizationId: organization.id, email: candidate.email } },
      update: { ...candidate, status: 'Active' },
      create: {
        id: fixtureId(200 + index),
        organizationId: organization.id,
        candidateCode: `CND-DEMO-${String(index + 1).padStart(3, '0')}`,
        ...candidate,
        status: 'Active',
      },
    });
  }
  const candidateRows = await tx.candidate.findMany({ where: { organizationId: organization.id } });
  const candidatesByEmail = Object.fromEntries(candidateRows.map((candidate) => [candidate.email, candidate]));
  const candidates = candidateSeeds.map((candidate) => candidatesByEmail[candidate.email]);

  const requestSeeds = [
    { id: fixtureId(300), code: 'VR-DEMO-001', position: positions.frontendEngineer, branch: branches.hq, requester: users.recruiter, status: 'Pending Approval', headcount: 2, employmentType: 'Full-time', reason: 'Product team expansion', budgetStatus: 'Budgeted', criticality: 'High', startDays: 30 },
    { id: fixtureId(301), code: 'VR-DEMO-002', position: positions.seniorEngineer, branch: branches.nasrCity, requester: users.hiringManager, status: 'Approved', headcount: 2, employmentType: 'Full-time', reason: 'New engineering squad', budgetStatus: 'Budgeted', criticality: 'Critical', startDays: 14 },
    { id: fixtureId(302), code: 'VR-DEMO-003', position: positions.pharmacist, branch: branches.alexandria, requester: users.recruiter, status: 'Approved', headcount: 1, employmentType: 'Full-time', reason: 'Branch coverage', budgetStatus: 'Unbudgeted', criticality: 'Normal', startDays: 45 },
    { id: fixtureId(303), code: 'VR-DEMO-004', position: positions.hrSpecialist, branch: branches.hq, requester: users.hiringManager, status: 'Rejected', headcount: 1, employmentType: 'Full-time', reason: 'Backfill request', budgetStatus: 'Budgeted', criticality: 'Normal', startDays: 60 },
    { id: fixtureId(304), code: 'VR-DEMO-005', position: positions.salesExecutive, branch: branches.nasrCity, requester: users.recruiter, status: 'Draft', headcount: 3, employmentType: 'Full-time', reason: 'Sales coverage', budgetStatus: 'Pending', criticality: 'Low', startDays: 75 },
  ];
  const requests = [];
  for (const request of requestSeeds) {
    const created = await upsertById(tx, 'vacancyRequest', request.id, {
      organizationId: organization.id,
      legalEntityId: legalEntity.id,
      branchId: request.branch.id,
      positionId: request.position.id,
      requesterId: request.requester.id,
      requestCode: request.code,
      status: request.status,
      requestedHeadcount: request.headcount,
      employmentType: request.employmentType,
      reason: request.reason,
      budgetStatus: request.budgetStatus,
      criticality: request.criticality,
      targetStartDate: dateFromNow(request.startDays),
      justification: `${request.reason}. Demo fixture for workflow state coverage.`,
      submittedAt: request.status === 'Draft' ? null : dateFromNow(-4),
      approvalRevision: 1,
    });
    requests.push({ ...request, record: created });
  }

  for (const request of requests) {
    const approvalStatuses = request.status === 'Approved'
      ? ['Approved', 'Approved', 'Approved']
      : request.status === 'Rejected'
        ? ['Approved', 'Rejected', 'Pending']
        : ['Pending', 'Pending', 'Pending'];
    const assignees = [users.hiringManager, users.admin, users.approver];
    for (let step = 1; step <= 3; step += 1) {
      await upsertById(tx, 'vacancyRequestApproval', fixtureId(320 + requests.indexOf(request) * 10 + step), {
        vacancyRequestId: request.id,
        revision: 1,
        step,
        roleCode: step === 1 ? 'HIRING_MANAGER' : step === 2 ? 'HR_MANAGER' : 'FINANCE_MANAGER',
        assigneeUserId: assignees[step - 1].id,
        status: approvalStatuses[step - 1],
        comment: approvalStatuses[step - 1] === 'Approved' ? 'Approved for demo workflow coverage.' : null,
        decidedAt: approvalStatuses[step - 1] === 'Pending' ? null : dateFromNow(-3 + step),
      });
    }
  }

  const vacancySeeds = [
    { id: fixtureId(400), code: 'VAC-DEMO-001', request: requests[1], position: positions.seniorEngineer, branch: branches.nasrCity, status: 'Open', headcount: 2, joined: 0 },
    { id: fixtureId(401), code: 'VAC-DEMO-002', request: requests[2], position: positions.pharmacist, branch: branches.alexandria, status: 'Partially Filled', headcount: 1, joined: 0 },
    { id: fixtureId(402), code: 'VAC-DEMO-003', request: requests[0], position: positions.frontendEngineer, branch: branches.hq, status: 'Open', headcount: 2, joined: 0 },
  ];
  const vacancies = [];
  for (const vacancy of vacancySeeds) {
    if (vacancy.request.status !== 'Approved') {
      await tx.vacancyRequest.update({ where: { id: vacancy.request.id }, data: { status: 'Approved' } });
    }
    const record = await upsertById(tx, 'vacancy', vacancy.id, {
      organizationId: organization.id,
      legalEntityId: legalEntity.id,
      branchId: vacancy.branch.id,
      positionId: vacancy.position.id,
      vacancyRequestId: vacancy.request.id,
      vacancyCode: vacancy.code,
      status: vacancy.status,
      approvedHeadcount: vacancy.headcount,
      joinedHeadcount: vacancy.joined,
      openedAt: dateFromNow(-18),
      targetStartDate: dateFromNow(30),
    });
    vacancies.push({ ...vacancy, record });
    for (const assignment of [users.recruiter, users.hiringManager]) {
      await upsertById(tx, 'vacancyAssignment', fixtureId(420 + vacancies.length * 10 + (assignment.id === users.recruiter.id ? 1 : 2)), {
        vacancyId: record.id,
        userId: assignment.id,
        roleCode: assignment.id === users.recruiter.id ? 'RECRUITER' : 'HIRING_MANAGER',
        isActive: true,
        assignedAt: dateFromNow(-17),
      });
    }
  }

  const appSeeds = [
    { code: 'APP-DEMO-001', vacancy: vacancies[0], candidate: candidates[0], stage: 'Applied', source: 'LinkedIn' },
    { code: 'APP-DEMO-002', vacancy: vacancies[0], candidate: candidates[1], stage: 'Screening', source: 'Referral' },
    { code: 'APP-DEMO-003', vacancy: vacancies[0], candidate: candidates[2], stage: 'Interview', source: 'Job Portal' },
    { code: 'APP-DEMO-004', vacancy: vacancies[0], candidate: candidates[3], stage: 'Offer', source: 'LinkedIn' },
    { code: 'APP-DEMO-005', vacancy: vacancies[1], candidate: candidates[4], stage: 'Pre-Hire', source: 'Referral' },
    { code: 'APP-DEMO-006', vacancy: vacancies[1], candidate: candidates[5], stage: 'Joined', source: 'Careers Page' },
    { code: 'APP-DEMO-007', vacancy: vacancies[2], candidate: candidates[6], stage: 'Rejected', source: 'Job Portal' },
    { code: 'APP-DEMO-008', vacancy: vacancies[2], candidate: candidates[7], stage: 'Withdrawn', source: 'Referral' },
    { code: 'APP-DEMO-009', vacancy: vacancies[2], candidate: candidates[8], stage: 'Screening', source: 'Walk-in' },
    { code: 'APP-DEMO-010', vacancy: vacancies[2], candidate: candidates[9], stage: 'Applied', source: 'LinkedIn' },
  ];
  const applications = [];
  const stagePaths = {
    Applied: ['Applied'],
    Screening: ['Applied', 'Screening'],
    Interview: ['Applied', 'Screening', 'Interview'],
    Offer: ['Applied', 'Screening', 'Interview', 'Offer'],
    'Pre-Hire': ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire'],
    Joined: ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'],
    Rejected: ['Applied', 'Screening', 'Rejected'],
    Withdrawn: ['Applied', 'Withdrawn'],
  };
  for (let index = 0; index < appSeeds.length; index += 1) {
    const application = appSeeds[index];
    const record = await upsertById(tx, 'application', fixtureId(500 + index), {
      organizationId: organization.id,
      applicationCode: application.code,
      vacancyId: application.vacancy.record.id,
      candidateId: application.candidate.id,
      stage: application.stage,
      source: application.source,
      primaryRecruiterId: users.recruiter.id,
      taskOwnerId: index % 2 === 0 ? users.recruiter.id : users.hiringManager.id,
      appliedAt: dateFromNow(-28 + index),
    });
    applications.push({ ...application, record });
    const path = stagePaths[application.stage];
    for (let step = 0; step < path.length; step += 1) {
      await upsertById(tx, 'applicationStatusHistory', fixtureId(550 + index * 10 + step), {
        applicationId: record.id,
        fromStage: step === 0 ? null : path[step - 1],
        toStage: path[step],
        changedById: step === 0 ? null : users.recruiter.id,
        reason: step === 0 ? 'Demo application created.' : `Moved to ${path[step]} for demo coverage.`,
        createdAt: dateFromNow(-28 + index + step),
      });
    }
  }

  const documentSeeds = [
    { candidate: candidates[0], name: 'Mariam Farouk - Resume.pdf', type: 'Resume', scanStatus: 'Pending' },
    { candidate: candidates[3], name: 'Youssef Adel - Resume.pdf', type: 'Resume', scanStatus: 'Clean' },
    { candidate: candidates[4], name: 'Salma Hany - National ID.pdf', type: 'Identity', scanStatus: 'Pending' },
    { candidate: candidates[5], name: 'Omar Fathy - Resume.pdf', type: 'Resume', scanStatus: 'Clean' },
  ];
  const documents = [];
  for (let index = 0; index < documentSeeds.length; index += 1) {
    const documentSeed = documentSeeds[index];
    const record = await upsertById(tx, 'candidateDocument', fixtureId(600 + index), {
      organizationId: organization.id,
      candidateId: documentSeed.candidate.id,
      documentType: documentSeed.type,
      fileName: documentSeed.name,
      fileSize: 240000 + index * 18000,
      mimeType: 'application/pdf',
      storageKey: `demo-fixtures/${documentSeed.candidate.candidateCode}/${index + 1}.pdf`,
      extractionText: `Demo metadata record for ${documentSeed.candidate.firstName} ${documentSeed.candidate.lastName}. Binary storage is not enabled in local fixtures.`,
      scanStatus: documentSeed.scanStatus,
      uploadedById: users.recruiter.id,
    });
    documents.push(record);
  }

  const screeningApplications = applications.filter((application) => ['Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'].includes(application.stage));
  for (let index = 0; index < screeningApplications.length; index += 1) {
    const application = screeningApplications[index];
    await upsertById(tx, 'screeningLog', fixtureId(650 + index), {
      organizationId: organization.id,
      applicationId: application.record.id,
      screenerId: users.recruiter.id,
      outcome: index === screeningApplications.length - 1 ? 'On Hold' : 'Passed',
      notes: index === screeningApplications.length - 1 ? 'Waiting for candidate availability.' : 'Meets the initial screening criteria.',
      screenedAt: dateFromNow(-16 + index),
    });
  }

  const interviewSeeds = [
    { application: applications[2], code: 'INT-DEMO-001', title: 'Technical interview - React and systems', type: 'Technical', status: 'Completed', startDays: -10, score: 4, recommendation: 'Hire' },
    { application: applications[3], code: 'INT-DEMO-002', title: 'Hiring manager interview', type: 'Managerial', status: 'Scheduled', startDays: 2 },
    { application: applications[4], code: 'INT-DEMO-003', title: 'Final culture interview', type: 'Behavioral', status: 'Scheduled', startDays: 5 },
    { application: applications[5], code: 'INT-DEMO-004', title: 'Completed panel interview', type: 'Executive', status: 'Completed', startDays: -20, score: 5, recommendation: 'Strong Hire' },
    { application: applications[6], code: 'INT-DEMO-005', title: 'Cancelled screening call', type: 'Screening', status: 'Cancelled', startDays: -7 },
  ];
  const interviews = [];
  for (let index = 0; index < interviewSeeds.length; index += 1) {
    const interviewSeed = interviewSeeds[index];
    const start = dateFromNow(interviewSeed.startDays);
    const record = await upsertById(tx, 'interview', fixtureId(700 + index), {
      organizationId: organization.id,
      interviewCode: interviewSeed.code,
      applicationId: interviewSeed.application.record.id,
      title: interviewSeed.title,
      interviewType: interviewSeed.type,
      scheduledStart: start,
      scheduledEnd: new Date(start.getTime() + 60 * 60 * 1000),
      timezone: 'Africa/Cairo',
      locationUrl: 'https://meet.example.com/recruitflow-demo',
      status: interviewSeed.status,
    });
    interviews.push(record);
    await tx.interviewAttendee.upsert({
      where: { interviewId_userId: { interviewId: record.id, userId: users.hiringManager.id } },
      update: { role: 'Hiring Manager', response: interviewSeed.status === 'Cancelled' ? 'Declined' : 'Accepted' },
      create: { interviewId: record.id, userId: users.hiringManager.id, role: 'Hiring Manager', response: interviewSeed.status === 'Cancelled' ? 'Declined' : 'Accepted' },
    });
    await tx.interviewAttendee.upsert({
      where: { interviewId_userId: { interviewId: record.id, userId: users.recruiter.id } },
      update: { role: 'Recruiter', response: 'Accepted' },
      create: { interviewId: record.id, userId: users.recruiter.id, role: 'Recruiter', response: 'Accepted' },
    });
    if (interviewSeed.score) {
      await upsertById(tx, 'interviewScorecard', fixtureId(720 + index), {
        interviewId: record.id,
        interviewerId: users.hiringManager.id,
        overallRating: interviewSeed.score,
        recommendation: interviewSeed.recommendation,
        strengths: 'Clear communication and strong technical ownership.',
        concerns: interviewSeed.score < 5 ? 'Needs deeper exposure to large-scale systems.' : null,
        notes: 'Completed demo scorecard.',
        isLocked: true,
        submittedAt: dateFromNow(-8 + index),
      });
    }
  }

  const offerSeeds = [
    { application: applications[3], code: 'OFF-DEMO-001', status: 'Pending Approval', approvalStatus: 'Pending', salary: 35000, joiningDays: 25 },
    { application: applications[4], code: 'OFF-DEMO-002', status: 'Sent', approvalStatus: 'Approved', salary: 28000, joiningDays: 12 },
    { application: applications[5], code: 'OFF-DEMO-003', status: 'Accepted', approvalStatus: 'Approved', salary: 42000, joiningDays: -12 },
    { application: applications[6], code: 'OFF-DEMO-004', status: 'Declined', approvalStatus: 'Approved', salary: 22000, joiningDays: -5 },
    { application: applications[8], code: 'OFF-DEMO-005', status: 'Draft', approvalStatus: 'Draft', salary: 30000, joiningDays: 40 },
  ];
  const offers = [];
  for (let index = 0; index < offerSeeds.length; index += 1) {
    const offerSeed = offerSeeds[index];
    const offer = await upsertById(tx, 'offer', fixtureId(800 + index), {
      organizationId: organization.id,
      applicationId: offerSeed.application.record.id,
      offerCode: offerSeed.code,
      status: offerSeed.status,
    });
    const version = await upsertById(tx, 'offerVersion', fixtureId(820 + index), {
      offerId: offer.id,
      versionNumber: 1,
      monthlyPackage: offerSeed.salary,
      annualFixed: offerSeed.salary * 12,
      contractType: 'Full-time',
      probationPeriod: '3 months',
      offerExpiry: dateFromNow(14),
      proposedJoiningDate: dateFromNow(offerSeed.joiningDays),
      workLocation: offerSeed.application.vacancy.branch.name,
      workingSchedule: 'Sunday - Thursday, 09:00 - 17:00',
      approvalStatus: offerSeed.approvalStatus,
      isLocked: ['Approved', 'Sent', 'Accepted'].includes(offerSeed.approvalStatus),
    });
    await tx.offer.update({ where: { id: offer.id }, data: { currentVersionId: version.id } });
    await upsertById(tx, 'offerComponent', fixtureId(840 + index), {
      offerVersionId: version.id,
      type: 'Salary',
      name: 'Monthly base salary',
      amount: offerSeed.salary,
      currency: 'EGP',
      frequency: 'Monthly',
      isTaxable: true,
    });
    await upsertById(tx, 'offerComponent', fixtureId(850 + index), {
      offerVersionId: version.id,
      type: 'Benefit',
      name: 'Medical insurance',
      amount: 1500,
      currency: 'EGP',
      frequency: 'Monthly',
      isTaxable: false,
    });
    await upsertById(tx, 'offerApproval', fixtureId(860 + index), {
      offerVersionId: version.id,
      approverUserId: users.approver.id,
      roleCode: 'OFFER_APPROVER',
      status: offerSeed.approvalStatus === 'Approved' ? 'Approved' : offerSeed.approvalStatus === 'Draft' ? 'Pending' : 'Pending',
      comment: offerSeed.approvalStatus === 'Approved' ? 'Package approved for demo.' : null,
      decidedAt: offerSeed.approvalStatus === 'Approved' ? dateFromNow(-6) : null,
    });
    offers.push({ ...offerSeed, record: offer });
  }

  const hiringSeeds = [
    { offer: offers[0], status: 'Pending Compliance', plannedDays: 25 },
    { offer: offers[1], status: 'Pending Final Approval', plannedDays: 12 },
    { offer: offers[2], status: 'Joined', plannedDays: -12 },
  ];
  const hiringCases = [];
  for (let index = 0; index < hiringSeeds.length; index += 1) {
    const hiringSeed = hiringSeeds[index];
    const application = hiringSeed.offer.application;
    const hiringCase = await upsertById(tx, 'hiringCase', fixtureId(900 + index), {
      organizationId: organization.id,
      applicationId: application.record.id,
      offerId: hiringSeed.offer.record.id,
      status: hiringSeed.status,
      plannedJoiningDate: dateFromNow(hiringSeed.plannedDays),
      actualJoiningDate: hiringSeed.status === 'Joined' ? dateFromNow(-12) : null,
      ownerUserId: users.recruiter.id,
    });
    hiringCases.push(hiringCase);
    const requirementSeeds = [
      ['Identity', 'National identity document', 'Verified'],
      ['Document', 'Signed offer letter', index === 0 ? 'Pending' : 'Submitted'],
      ['License', 'Professional license', index === 2 ? 'Verified' : 'Pending'],
    ];
    for (let reqIndex = 0; reqIndex < requirementSeeds.length; reqIndex += 1) {
      const [type, name, status] = requirementSeeds[reqIndex];
      await upsertById(tx, 'complianceRequirement', fixtureId(920 + index * 10 + reqIndex), {
        hiringCaseId: hiringCase.id,
        type,
        name,
        status,
        isRequired: reqIndex !== 2 || index === 2,
        expiryDate: type === 'License' ? dateFromNow(365) : null,
        verifiedAt: status === 'Verified' ? dateFromNow(-4) : null,
        verifiedById: status === 'Verified' ? users.licenseSpecialist.id : null,
      });
    }
    await upsertById(tx, 'hiringCaseApproval', fixtureId(960 + index), {
      hiringCaseId: hiringCase.id,
      roleCode: 'FINAL_HIRING_APPROVER',
      status: hiringSeed.status === 'Joined' ? 'Approved' : 'Pending',
      comment: hiringSeed.status === 'Joined' ? 'Final approval completed.' : null,
      approverUserId: users.approver.id,
      decidedAt: hiringSeed.status === 'Joined' ? dateFromNow(-14) : null,
    });
  }

  const poolSeeds = [
    { id: fixtureId(1000), name: 'Engineering Bench', description: 'Strong software engineering candidates for upcoming squads.', tags: ['Engineering', 'React', 'Backend'], status: 'Active' },
    { id: fixtureId(1001), name: 'Healthcare Professionals', description: 'Licensed healthcare candidates with active consent.', tags: ['Pharmacy', 'Healthcare'], status: 'Active' },
    { id: fixtureId(1002), name: 'Needs Consent Renewal', description: 'Candidates requiring consent renewal before outreach.', tags: ['Consent', 'Review'], status: 'Review' },
  ];
  const pools = [];
  for (const poolSeed of poolSeeds) {
    pools.push(await upsertById(tx, 'talentPool', poolSeed.id, {
      organizationId: organization.id,
      name: poolSeed.name,
      description: poolSeed.description,
      tags: poolSeed.tags,
      status: poolSeed.status,
    }));
  }
  const poolMemberships = [
    [pools[0], candidates[0], 'Eligible', 'Active', 90],
    [pools[0], candidates[1], 'Eligible', 'Active', 120],
    [pools[0], candidates[3], 'Contacted', 'Active', 60],
    [pools[1], candidates[8], 'Eligible', 'Active', 180],
    [pools[2], candidates[6], 'Consent Expiring', 'Expiring', 5],
  ];
  for (let index = 0; index < poolMemberships.length; index += 1) {
    const [pool, candidate, eligibility, consentStatus, expiryDays] = poolMemberships[index];
    await upsertById(tx, 'talentPoolCandidate', fixtureId(1020 + index), {
      talentPoolId: pool.id,
      candidateId: candidate.id,
      eligibility,
      coolingOffUntil: null,
      consentStatus,
      consentExpiry: dateFromNow(expiryDays),
      source: candidate.source,
      addedAt: dateFromNow(-20 + index),
    });
  }

  const importJob = await upsertById(tx, 'candidateImportJob', fixtureId(1100), {
    organizationId: organization.id,
    uploadedById: users.recruiter.id,
    fileName: 'demo-candidate-batch.csv',
    status: 'Review',
    totalRows: 6,
    validRows: 3,
    invalidRows: 1,
    duplicateRows: 2,
    newRows: 0,
    updateRows: 0,
  });
  const importRows = [
    ['Layla', 'Hassan', 'layla.hassan@example.com', '+201000000001', 'Valid', null, null],
    ['Tarek', 'Maged', 'tarek.maged@example.com', '+201000000002', 'Valid', null, null],
    ['Reem', 'Nader', 'reem.nader@example.com', '+201000000003', 'Valid', null, null],
    ['Missing', '', 'invalid-email', '', 'Invalid', 'Email format is invalid', null],
    ['Mariam', 'Farouk', 'mariam.farouk@example.com', '+201001234567', 'Duplicate', 'Email already exists in candidates', null],
    ['Kareem', 'Ezzat', 'kareem.ezzat@example.com', '+201119876543', 'Duplicate', 'Email already exists in candidates', 'Update'],
  ];
  for (let index = 0; index < importRows.length; index += 1) {
    const [firstName, lastName, email, phone, result, details, decision] = importRows[index];
    await upsertById(tx, 'candidateImportRow', fixtureId(1110 + index), {
      jobId: importJob.id,
      rowNumber: index + 1,
      rawData: { firstName, lastName, email, phone },
      firstName: firstName || null,
      lastName: lastName || null,
      email: email || null,
      phone: phone || null,
      result,
      details,
      decision,
    });
  }

  const pipeline = await upsertById(tx, 'pipelineTemplate', fixtureId(1150), {
    organizationId: organization.id,
    name: 'RecruitFlow Standard Hiring Pipeline',
    isDefault: true,
    status: 'Published',
  });
  const pipelineStages = [
    ['Applied', 'Application', 1, 1, 'Application received', 'Initial screening complete'],
    ['Screening', 'Screening', 2, 3, 'Candidate meets minimum criteria', 'Screening decision recorded'],
    ['Interview', 'Interview', 3, 5, 'Interview panel assigned', 'Scorecard submitted'],
    ['Offer', 'Offer', 4, 3, 'Offer package drafted', 'Approval decision recorded'],
    ['Pre-Hire', 'Pre-Hire', 5, 7, 'Compliance case opened', 'Required documents verified'],
    ['Joined', 'Outcome', 6, null, 'Final approval complete', null],
  ];
  for (let index = 0; index < pipelineStages.length; index += 1) {
    const [name, stageType, sortOrder, slaDays, entryGate, exitGate] = pipelineStages[index];
    await upsertById(tx, 'pipelineStage', fixtureId(1160 + index), {
      templateId: pipeline.id,
      name,
      stageType,
      sortOrder,
      slaDays,
      defaultOwner: index < 4 ? 'RECRUITER' : 'HR_OPERATIONS',
      entryGate,
      exitGate,
      status: 'Active',
    });
  }

  const integrationSeeds = [
    ['LinkedIn Recruiter', 'LinkedIn', 'Sourcing', 'Connected'],
    ['Microsoft 365 Calendar', 'Microsoft Graph', 'Calendar', 'Available'],
    ['Payroll Export', 'CSV Export', 'HRIS', 'Available'],
    ['Background Check Provider', 'SecureCheck', 'Compliance', 'Unavailable'],
  ];
  for (let index = 0; index < integrationSeeds.length; index += 1) {
    const [name, provider, category, status] = integrationSeeds[index];
    await upsertById(tx, 'integration', fixtureId(1180 + index), {
      organizationId: organization.id,
      name,
      provider,
      category,
      status,
      configJson: { demo: true, note: 'Local fixture; no external credentials configured.' },
      lastSyncAt: status === 'Connected' ? dateFromNow(-1) : null,
    });
  }

  const notificationSeeds = [
    [users.admin, 'ApprovalDecision', 'Vacancy request approved', 'VR-DEMO-002 was approved and is ready for recruiting.', 'VacancyRequest', requests[1].id, null],
    [users.admin, 'TaskAssigned', 'Review pending offer', 'Offer OFF-DEMO-001 is waiting for your approval.', 'Offer', offers[0].record.id, null],
    [users.admin, 'ComplianceCheck', 'Compliance item needs attention', 'A hiring case has a pending identity document.', 'HiringCase', hiringCases[0].id, null],
    [users.recruiter, 'CandidateAdded', 'New candidate added', 'A candidate was added to Engineering Bench.', 'TalentPool', pools[0].id, null],
    [users.recruiter, 'InterviewScheduled', 'Interview scheduled', 'INT-DEMO-002 is scheduled in two days.', 'Interview', interviews[1].id, dateFromNow(-1)],
  ];
  for (let index = 0; index < notificationSeeds.length; index += 1) {
    const [recipient, type, title, message, entityType, entityId, readAt] = notificationSeeds[index];
    await upsertById(tx, 'notification', fixtureId(1200 + index), {
      organizationId: organization.id,
      recipientUserId: recipient.id,
      type,
      title,
      message,
      entityType,
      entityId,
      readAt,
      createdAt: dateFromNow(-index),
    });
  }

  const taskSeeds = [
    [users.admin, 'ApprovalReview', 'Approve senior engineer offer', 'Review salary package and approve or request changes.', 'Critical', 'Open', 1, 'Offer', offers[0].record.id],
    [users.admin, 'ComplianceCheck', 'Verify identity document', 'Review the pending identity document for the first hiring case.', 'High', 'In Progress', -1, 'HiringCase', hiringCases[0].id],
    [users.recruiter, 'InterviewScheduling', 'Prepare technical interview panel', 'Confirm attendees and interview scorecard for INT-DEMO-002.', 'Normal', 'Open', 2, 'Interview', interviews[1].id],
    [users.recruiter, 'CandidateFollowUp', 'Follow up with engineering candidate', 'Send a follow-up message after the screening call.', 'High', 'Completed', -3, 'Application', applications[1].record.id],
    [users.hiringManager, 'VacancyReview', 'Review new vacancy request', 'Review the pending request for two frontend engineers.', 'Normal', 'Open', 4, 'VacancyRequest', requests[0].id],
  ];
  for (let index = 0; index < taskSeeds.length; index += 1) {
    const [assignee, type, title, description, priority, status, dueDays, entityType, entityId] = taskSeeds[index];
    await upsertById(tx, 'task', fixtureId(1230 + index), {
      organizationId: organization.id,
      assigneeUserId: assignee.id,
      createdById: users.admin.id,
      type,
      title,
      description,
      priority,
      status,
      dueAt: dateFromNow(dueDays),
      entityType,
      entityId,
      completedAt: status === 'Completed' ? dateFromNow(-2) : null,
      createdAt: dateFromNow(-7 + index),
      updatedAt: dateFromNow(-1),
    });
  }

  const auditSeeds = [
    ['VACANCY_REQUEST_CREATED', 'VacancyRequest', requests[0].id, 'SUCCESS'],
    ['VACANCY_REQUEST_APPROVED', 'VacancyRequest', requests[1].id, 'SUCCESS'],
    ['APPLICATION_STAGE_CHANGED', 'Application', applications[2].record.id, 'SUCCESS'],
    ['OFFER_SUBMITTED_FOR_APPROVAL', 'Offer', offers[0].record.id, 'SUCCESS'],
    ['COMPLIANCE_DOCUMENT_PENDING', 'HiringCase', hiringCases[0].id, 'SUCCESS'],
    ['LOGIN_ATTEMPT', 'User', users.admin.id, 'SUCCESS'],
  ];
  for (let index = 0; index < auditSeeds.length; index += 1) {
    const [action, entityType, entityId, result] = auditSeeds[index];
    await upsertById(tx, 'auditLog', fixtureId(1270 + index), {
      organizationId: organization.id,
      actorUserId: users.admin.id,
      action,
      entityType,
      entityId,
      result,
      reason: null,
      beforeData: null,
      afterData: { demoFixture: true },
      correlationId: `demo-correlation-${index + 1}`,
      ipAddress: '127.0.0.1',
      createdAt: dateFromNow(-index - 1),
    });
  }

  return {
    candidates: candidates.length,
    vacancyRequests: requests.length,
    vacancies: vacancies.length,
    applications: applications.length,
    interviews: interviews.length,
    offers: offers.length,
    hiringCases: hiringCases.length,
    talentPools: pools.length,
    importJobs: 1,
    pipelineTemplates: 1,
    integrations: integrationSeeds.length,
    notifications: notificationSeeds.length,
    tasks: taskSeeds.length,
    auditLogs: auditSeeds.length,
  };
}

module.exports = { seedDemoFixtures };
