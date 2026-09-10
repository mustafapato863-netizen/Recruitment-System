/**
 * M1-G4 Deterministic Multi-Tenant Fixture Manager
 *
 * Creates and tears down isolated, deterministic Org A and Org B fixtures
 * across all 26 resource families and child relations for a single test run.
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@recruitflow/database');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

const prisma = new PrismaClient();

async function createTenantFixtures(orgId, suffix, runId) {
  const prefix = `M1G4_${runId}_${suffix}`;
  const adminUser = await prisma.user.findFirst({
    where: {
      organizationId: orgId,
      email: { in: ['ahmed.mahmoud@recruitflow.local', 'tarek.kamal@acme-health.local'] },
    },
  }) || (await prisma.user.findFirst({ where: { organizationId: orgId } }));

  // 1. Branch
  const branch = await prisma.branch.create({
    data: {
      organizationId: orgId,
      code: `BR_${prefix}`.slice(0, 50),
      name: `Branch ${suffix} ${runId}`,
      city: 'Cairo',
    },
  });

  // 2. Position
  const position = await prisma.position.create({
    data: {
      organizationId: orgId,
      code: `POS_${prefix}`.slice(0, 50),
      title: `Position ${suffix} ${runId}`,
    },
  });

  // 4. User
  const user = await prisma.user.create({
    data: {
      organizationId: orgId,
      email: `${prefix.toLowerCase()}@recruitflow.test`,
      emailNormalized: `${prefix.toLowerCase()}@recruitflow.test`,
      displayName: `User ${suffix} ${runId}`,
      status: 'Active',
    },
  });

  // 5. Custom Role
  const role = await prisma.role.create({
    data: {
      organizationId: orgId,
      code: `ROLE_${prefix}`.slice(0, 80),
      name: `Custom Role ${suffix} ${runId}`,
      status: 'Active',
    },
  });

  // 6. Vacancy Request
  const vacancyRequest = await prisma.vacancyRequest.create({
    data: {
      organizationId: orgId,
      requestCode: `VR_${prefix}`.slice(0, 50),
      branchId: branch.id,
      positionId: position.id,
      requesterId: user.id,
      requestedHeadcount: 1,
      status: 'Draft',
    },
  });

  // 7. Vacancy
  const vacancy = await prisma.vacancy.create({
    data: {
      organizationId: orgId,
      vacancyCode: `VAC_${prefix}`.slice(0, 50),
      vacancyRequestId: vacancyRequest.id,
      branchId: branch.id,
      positionId: position.id,
      status: 'Open',
      approvedHeadcount: 1,
    },
  });

  // 8. Candidate
  const candidate = await prisma.candidate.create({
    data: {
      organizationId: orgId,
      candidateCode: `CAN_${prefix}`.slice(0, 50),
      firstName: `Candidate${suffix}`,
      lastName: `${runId}`,
      email: `cand_${prefix.toLowerCase()}@example.com`,
      status: 'Active',
      source: 'Direct',
    },
  });

  // 9. Candidate Document
  const document = await prisma.candidateDocument.create({
    data: {
      organizationId: orgId,
      candidateId: candidate.id,
      documentType: 'CV',
      fileName: `cv_${prefix}.pdf`,
      fileSize: 1024,
      mimeType: 'application/pdf',
      storageKey: `docs/${orgId}/${candidate.id}/cv_${prefix}.pdf`,
      storageProvider: 'local-private',
      scanStatus: 'Clean',
      uploadedById: user.id,
    },
  });

  // 10. Application
  const application = await prisma.application.create({
    data: {
      organizationId: orgId,
      applicationCode: `APP_${prefix}`.slice(0, 50),
      candidateId: candidate.id,
      vacancyId: vacancy.id,
      stage: 'Applied',
    },
  });

  // 11. Screening Log
  const screeningLog = await prisma.screeningLog.create({
    data: {
      organizationId: orgId,
      applicationId: application.id,
      screenerId: user.id,
      outcome: 'Passed',
    },
  });

  // 12. Interview
  const interview = await prisma.interview.create({
    data: {
      organizationId: orgId,
      interviewCode: `INT_${prefix}`.slice(0, 50),
      applicationId: application.id,
      title: `Interview ${suffix} ${runId}`,
      interviewType: 'Technical',
      scheduledStart: new Date(),
      scheduledEnd: new Date(Date.now() + 3600000),
    },
  });

  // 13. Interview Attendee
  const attendee = await prisma.interviewAttendee.create({
    data: {
      interviewId: interview.id,
      userId: user.id,
      role: 'Interviewer',
    },
  });

  // 14. Interview Scorecard
  const scorecard = await prisma.interviewScorecard.create({
    data: {
      interviewId: interview.id,
      interviewerId: user.id,
      overallRating: 5,
      recommendation: 'Strong Hire',
    },
  });

  // 15. Offer
  const offer = await prisma.offer.create({
    data: {
      organizationId: orgId,
      offerCode: `OFF_${prefix}`.slice(0, 50),
      applicationId: application.id,
      status: 'Draft',
    },
  });

  // 16. Offer Version
  const offerVersion = await prisma.offerVersion.create({
    data: {
      offerId: offer.id,
      versionNumber: 1,
      monthlyPackage: 15000,
    },
  });

  // 17. Offer Approval
  const offerApproval = await prisma.offerApproval.create({
    data: {
      offerVersionId: offerVersion.id,
      approverUserId: user.id,
      roleCode: 'ADMINISTRATOR',
      status: 'Pending',
    },
  });

  // 18. Offer Component
  const offerComponent = await prisma.offerComponent.create({
    data: {
      offerVersionId: offerVersion.id,
      type: 'Salary',
      name: 'Base Salary',
      amount: 15000,
    },
  });

  // 19. Hiring Case
  const hiringCase = await prisma.hiringCase.create({
    data: {
      organizationId: orgId,
      applicationId: application.id,
      offerId: offer.id,
      status: 'Pending Compliance',
      ownerUserId: user.id,
    },
  });

  // 20. Compliance Requirement
  const complianceRequirement = await prisma.complianceRequirement.create({
    data: {
      hiringCaseId: hiringCase.id,
      type: 'Document',
      name: `ID Card ${suffix}`,
      status: 'Pending',
    },
  });

  // 21. Hiring Case Approval
  const hiringCaseApproval = await prisma.hiringCaseApproval.create({
    data: {
      hiringCaseId: hiringCase.id,
      roleCode: 'HR_MANAGER',
      status: 'Pending',
      approverUserId: user.id,
    },
  });

  // 22. Talent Pool
  const talentPool = await prisma.talentPool.create({
    data: {
      organizationId: orgId,
      name: `Talent Pool ${suffix} ${runId}`,
      status: 'Active',
    },
  });

  // 23. Talent Pool Candidate
  const talentPoolCandidate = await prisma.talentPoolCandidate.create({
    data: {
      talentPoolId: talentPool.id,
      candidateId: candidate.id,
    },
  });

  // 24. Pipeline Template
  const pipelineTemplate = await prisma.pipelineTemplate.create({
    data: {
      organizationId: orgId,
      name: `Pipeline ${suffix} ${runId}`,
    },
  });

  // 25. Pipeline Stage
  const pipelineStage = await prisma.pipelineStage.create({
    data: {
      templateId: pipelineTemplate.id,
      name: `Stage ${suffix}`,
      stageType: 'Interview',
      sortOrder: 1,
    },
  });

  // 26. Candidate Import Job
  const importJob = await prisma.candidateImportJob.create({
    data: {
      organizationId: orgId,
      fileName: `import_${prefix}.xlsx`,
      status: 'Completed',
      uploadedById: user.id,
    },
  });

  // 27. Candidate Import Row
  const importRow = await prisma.candidateImportRow.create({
    data: {
      jobId: importJob.id,
      rowNumber: 1,
      rawData: { email: `import_row_${prefix.toLowerCase()}@example.com` },
      firstName: `RowFirst${suffix}`,
      lastName: `${runId}`,
    },
  });

  // 28. Task
  const task = await prisma.task.create({
    data: {
      organizationId: orgId,
      assigneeUserId: adminUser ? adminUser.id : user.id,
      createdById: user.id,
      type: 'General',
      title: `Task ${suffix} ${runId}`,
    },
  });

  // 29. Notification
  const notification = await prisma.notification.create({
    data: {
      organizationId: orgId,
      recipientUserId: adminUser ? adminUser.id : user.id,
      type: 'General',
      title: `Notification ${suffix} ${runId}`,
      message: `Message for ${suffix}`,
    },
  });

  // 30. Integration
  const integration = await prisma.integration.create({
    data: {
      organizationId: orgId,
      name: `Integration ${suffix} ${runId}`,
      provider: 'Webhook',
      category: 'Notification',
    },
  });

  return {
    organizationId: orgId,
    suffix,
    prefix,
    branch,
    position,
    user,
    role,
    vacancyRequest,
    vacancy,
    candidate,
    document,
    application,
    screeningLog,
    interview,
    attendee,
    scorecard,
    offer,
    offerVersion,
    offerApproval,
    offerComponent,
    hiringCase,
    complianceRequirement,
    hiringCaseApproval,
    talentPool,
    talentPoolCandidate,
    pipelineTemplate,
    pipelineStage,
    importJob,
    importRow,
    task,
    notification,
    integration,
  };
}

async function setup() {
  const runId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Retrieve Org A & Org B root IDs
  let orgA = await prisma.organization.findUnique({ where: { id: '10000000-0000-4000-8000-000000000001' } });
  if (!orgA) {
    orgA = await prisma.organization.findFirst({ where: { status: 'Active' } });
  }
  if (!orgA) throw new Error('Org A not found');

  let orgB = await prisma.organization.findUnique({ where: { id: '20000000-0000-4000-8000-000000000001' } });
  if (!orgB) {
    orgB = await prisma.organization.findFirst({ where: { id: { not: orgA.id }, status: 'Active' } });
  }
  if (!orgB) throw new Error('Org B not found');

  const fixturesA = await createTenantFixtures(orgA.id, 'OrgA', runId);
  const fixturesB = await createTenantFixtures(orgB.id, 'OrgB', runId);

  const manifest = {
    runId,
    orgAId: orgA.id,
    orgBId: orgB.id,
    fixturesA,
    fixturesB,
  };

  return manifest;
}

async function cleanup(runId) {
  if (!runId) return;

  const prefix = `M1G4_${runId}`;
  const prefixLower = prefix.toLowerCase();

  // 1. Integrations
  await prisma.integration.deleteMany({ where: { name: { contains: prefix } } });

  // 2. Notifications & Tasks
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { title: { contains: prefix } },
        { recipient: { email: { contains: prefixLower } } },
      ],
    },
  });
  await prisma.task.deleteMany({
    where: {
      OR: [
        { title: { contains: prefix } },
        { assignee: { email: { contains: prefixLower } } },
        { createdBy: { email: { contains: prefixLower } } },
      ],
    },
  });

  // 3. Import Rows & Jobs
  await prisma.candidateImportRow.deleteMany({ where: { job: { fileName: { contains: prefix } } } });
  await prisma.candidateImportJob.deleteMany({
    where: {
      OR: [
        { fileName: { contains: prefix } },
        { uploadedBy: { email: { contains: prefixLower } } },
      ],
    },
  });

  // 4. Pipeline Stages & Templates
  await prisma.pipelineStage.deleteMany({ where: { template: { name: { contains: prefix } } } });
  await prisma.pipelineTemplate.deleteMany({ where: { name: { contains: prefix } } });

  // 5. Talent Pool Candidates & Talent Pools
  await prisma.talentPoolCandidate.deleteMany({
    where: {
      OR: [
        { talentPool: { name: { contains: prefix } } },
        { candidate: { candidateCode: { contains: prefix } } },
      ],
    },
  });
  await prisma.talentPool.deleteMany({ where: { name: { contains: prefix } } });

  // 6. Hiring Case Approvals & Compliance Requirements
  await prisma.hiringCaseApproval.deleteMany({
    where: {
      OR: [
        { hiringCase: { application: { applicationCode: { contains: prefix } } } },
        { approver: { email: { contains: prefixLower } } },
      ],
    },
  });
  await prisma.complianceRequirement.deleteMany({
    where: {
      OR: [
        { hiringCase: { application: { applicationCode: { contains: prefix } } } },
        { verifier: { email: { contains: prefixLower } } },
      ],
    },
  });
  await prisma.hiringCase.deleteMany({
    where: {
      OR: [
        { application: { applicationCode: { contains: prefix } } },
        { owner: { email: { contains: prefixLower } } },
      ],
    },
  });

  // 7. Offer Approvals, Components, Versions, Offers
  await prisma.offerApproval.deleteMany({
    where: {
      OR: [
        { offerVersion: { offer: { offerCode: { contains: prefix } } } },
        { approver: { email: { contains: prefixLower } } },
      ],
    },
  });
  await prisma.offerComponent.deleteMany({ where: { offerVersion: { offer: { offerCode: { contains: prefix } } } } });
  await prisma.offerVersion.deleteMany({ where: { offer: { offerCode: { contains: prefix } } } });
  await prisma.offer.deleteMany({ where: { offerCode: { contains: prefix } } });

  // 8. Interview Scorecards, Attendees, Interviews
  await prisma.interviewScorecard.deleteMany({
    where: {
      OR: [
        { interview: { interviewCode: { contains: prefix } } },
        { interviewer: { email: { contains: prefixLower } } },
      ],
    },
  });
  await prisma.interviewAttendee.deleteMany({
    where: {
      OR: [
        { interview: { interviewCode: { contains: prefix } } },
        { user: { email: { contains: prefixLower } } },
      ],
    },
  });
  await prisma.interview.deleteMany({ where: { interviewCode: { contains: prefix } } });

  // 9. Screening Logs, Applications
  await prisma.screeningLog.deleteMany({
    where: {
      OR: [
        { application: { applicationCode: { contains: prefix } } },
        { screener: { email: { contains: prefixLower } } },
      ],
    },
  });
  await prisma.applicationStatusHistory.deleteMany({ where: { application: { applicationCode: { contains: prefix } } } });
  await prisma.application.deleteMany({ where: { applicationCode: { contains: prefix } } });

  // 10. Documents & Candidates
  await prisma.candidateDocument.deleteMany({
    where: {
      OR: [
        { fileName: { contains: prefix } },
        { uploadedBy: { email: { contains: prefixLower } } },
        { deletedBy: { email: { contains: prefixLower } } },
      ],
    },
  });
  await prisma.candidate.deleteMany({ where: { candidateCode: { contains: prefix } } });

  // 11. Vacancies & Vacancy Requests
  await prisma.vacancyAssignment.deleteMany({
    where: {
      OR: [
        { vacancy: { vacancyCode: { contains: prefix } } },
        { user: { email: { contains: prefixLower } } },
      ],
    },
  });
  await prisma.vacancy.deleteMany({ where: { vacancyCode: { contains: prefix } } });
  await prisma.vacancyRequestApproval.deleteMany({
    where: {
      OR: [
        { vacancyRequest: { requestCode: { contains: prefix } } },
        { assignee: { email: { contains: prefixLower } } },
      ],
    },
  });
  await prisma.vacancyRequest.deleteMany({
    where: {
      OR: [
        { requestCode: { contains: prefix } },
        { requester: { email: { contains: prefixLower } } },
      ],
    },
  });

  // 12. Roles, Users, Positions, and Branches
  await prisma.userRole.deleteMany({ where: { user: { email: { contains: prefixLower } } } });
  await prisma.rolePermission.deleteMany({ where: { role: { code: { contains: prefix } } } });
  await prisma.role.deleteMany({ where: { code: { contains: prefix } } });
  await prisma.user.deleteMany({ where: { email: { contains: prefixLower } } });
  await prisma.position.deleteMany({ where: { code: { contains: prefix } } });
  await prisma.branch.deleteMany({ where: { code: { contains: prefix } } });
}

module.exports = {
  setup,
  cleanup,
  prisma,
};

// CLI Support
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'setup') {
    setup().then((manifest) => {
      console.log(JSON.stringify(manifest));
      process.exit(0);
    }).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  } else if (cmd === 'cleanup') {
    cleanup(process.argv[3]).then(() => {
      console.log(JSON.stringify({ cleaned: true, runId: process.argv[3] }));
      process.exit(0);
    }).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
}
