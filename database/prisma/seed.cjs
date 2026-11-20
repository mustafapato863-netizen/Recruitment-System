const path = require('node:path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@recruitflow/database');
const { seedDemoFixtures } = require('./demo-fixtures.cjs');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// bcryptjs hash of the local seed password ('Password123!') with cost factor 10
const DEFAULT_PASSWORD_HASH = '$2b$10$dd0OAfjCvUL/waxTy79xZe0H7QN3r7oEbPPKJ9dwg97.y70rZgep6';

const prisma = new PrismaClient();

async function resyncCodeSequences() {
  const year = new Date().getUTCFullYear();
  const sequenceDefinitions = [
    { key: `CND:${year}`, model: 'candidate', codeField: 'candidateCode', prefix: 'CND' },
    { key: `APP:${year}`, model: 'application', codeField: 'applicationCode', prefix: 'APP' },
    { key: `INT:${year}`, model: 'interview', codeField: 'interviewCode', prefix: 'INT' },
    { key: `OFF:${year}`, model: 'offer', codeField: 'offerCode', prefix: 'OFF' },
    { key: `VR:${year}`, model: 'vacancyRequest', codeField: 'requestCode', prefix: 'VR' },
    { key: `VAC:${year}`, model: 'vacancy', codeField: 'vacancyCode', prefix: 'VAC' },
  ];

  for (const { key, model, codeField, prefix } of sequenceDefinitions) {
    const records = await prisma[model].findMany({ select: { [codeField]: true } });
    const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
    const maxSeq = records.reduce((max, record) => {
      const match = String(record[codeField] ?? '').match(pattern);
      return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
    }, 0);

    if (maxSeq > 0) {
      // Never rewind: a code may have been issued (sequence bumped) but its row not written yet.
      await prisma.codeSequence.upsert({ where: { key }, create: { key, lastIssued: maxSeq }, update: {} });
      await prisma.codeSequence.updateMany({ where: { key, lastIssued: { lt: maxSeq } }, data: { lastIssued: maxSeq } });
    }
  }
}

/**
 * C3: one master-data base for every reason list (apps/api/src/master-data/reason-lists.ts).
 * Deactivate-only; "Other" (where present) needs a note. Idempotent: upsert on (org, category, name), never overwrites.
 */
const REASON_LISTS = {
  'hold-reasons': [['BUDGET_REVIEW', 'Budget review'], ['HIRING_FREEZE', 'Hiring freeze'], ['ROLE_UNDER_REVIEW', 'Role under review'], ['AWAITING_INTERNAL_CANDIDATE', 'Awaiting internal candidate'], ['OTHER', 'Other']],
  'close-reasons': [['POSITION_NO_LONGER_NEEDED', 'Position no longer needed'], ['BUDGET_WITHDRAWN', 'Budget withdrawn'], ['FILLED_INTERNALLY', 'Filled internally'], ['OTHER', 'Other']],
  'rejection-reasons': [['REQ_CANCELLED', 'Requisition cancelled'], ['DECLINED_OFFER', 'Declined offer'], ['WITHDRAWN_BY_CANDIDATE', 'Withdrawn by candidate'], ['NOT_QUALIFIED', 'Not qualified'], ['FAILED_SCREENING', 'Did not pass screening'], ['FAILED_INTERVIEW', 'Did not pass interview'], ['NO_RESPONSE', 'No response from candidate'], ['POSITION_FILLED', 'Position filled'], ['OTHER', 'Other']],
  'reassign-reasons': [['WORKLOAD_BALANCING', 'Workload balancing'], ['OWNER_ON_LEAVE', 'Owner on leave'], ['OWNER_LEAVING', 'Owner leaving'], ['SPECIALIST_NEEDED', 'Specialist needed'], ['OTHER', 'Other']],
};
/** B5 seeding path (inside the org transaction); same single list as seedReasonLists. */
async function seedRejectionReasons(tx, organizationId) {
  await tx.masterDataValue.createMany({
    data: REASON_LISTS['rejection-reasons'].map(([code, name]) => ({ organizationId, category: 'rejection-reasons', code, name, status: 'Active' })),
    skipDuplicates: true,
  });
}

// B7: minimal grades (master data) and AED monthly-base bands for the demo branch.
async function seedGradeBands(tx, organizationId, branchId) {
  const grades = [['G5', 'Grade 5', 8000, 12000], ['G6', 'Grade 6', 12000, 18000], ['G7', 'Grade 7', 18000, 26000]];
  for (const [code, name, min, max] of grades) {
    const grade = await tx.masterDataValue.upsert({
      where: { organizationId_category_name: { organizationId, category: 'grades', name } },
      update: {},
      create: { organizationId, category: 'grades', code, name, status: 'Active' },
    });
    const exists = await tx.gradeBand.findFirst({ where: { organizationId, gradeId: grade.id, branchId, currency: 'AED', status: 'Active' } });
    if (!exists) await tx.gradeBand.create({ data: { organizationId, gradeId: grade.id, branchId, currency: 'AED', minMonthlyBase: min, maxMonthlyBase: max } });
  }
}

async function seedReasonLists(organizationId) {
  for (const [category, values] of Object.entries(REASON_LISTS)) {
    for (const [code, name] of values) {
      await prisma.masterDataValue.upsert({
        where: { organizationId_category_name: { organizationId, category, name } },
        create: { organizationId, category, name, code },
        update: {},
      });
    }
  }
}

// B9: exactly one pipeline template (the default). Idempotent: does nothing if an active template exists.
async function seedDefaultPipeline(tx, organizationId) {
  const existing = await tx.pipelineTemplate.count({ where: { organizationId, status: { not: 'Archived' } } });
  if (existing) return;
  const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'];
  await tx.pipelineTemplate.create({
    data: {
      organizationId, name: 'Default pipeline', isDefault: true, status: 'Active',
      stages: { create: stages.map((name, i) => ({ name, stageType: name, sortOrder: i, required: true, isHiredStage: name === 'Joined' })) },
    },
  });
}

/**
 * B7 demo: manager links (users.managerId), a grade on every demo job's requisition and
 * matching AED bands for each demo job's site, so a demo can show decide and reassign.
 * Recruiters report to the Talent Manager (Mona); Mona reports to the Hiring Manager (Hassan),
 * which also demonstrates escalation when Mona owns a file herself.
 */
async function seedDecisionDemo(tx, organizationId, users) {
  const mona = users['mona.manager@recruitflow.local'];
  const hassan = users['hassan.ali@recruitflow.local'];
  if (!mona || !hassan) return;
  await tx.user.update({ where: { id: mona.id }, data: { managerId: hassan.id } });
  // Hassan manages Mona and Omar. Omar manages Lady, so she must not be pulled onto Mona's team.
  const omar = await tx.user.findFirst({ where: { organizationId, email: 'omar.hassan@recruitflow.local' }, select: { id: true } });
  const lady = await tx.user.findFirst({ where: { organizationId, email: 'lady@recruitflow.local' }, select: { id: true } });
  if (omar) await tx.user.update({ where: { id: omar.id }, data: { managerId: hassan.id } });
  if (lady && omar) await tx.user.update({ where: { id: lady.id }, data: { managerId: omar.id } });
  const held = [mona.id, hassan.id, ...(omar ? [omar.id] : []), ...(lady ? [lady.id] : [])];
  const recruiters = await tx.user.findMany({
    where: { organizationId, managerId: null, id: { notIn: held }, userRoles: { some: { role: { code: 'RECRUITER' } } } },
    select: { id: true },
  });
  for (const r of recruiters) await tx.user.update({ where: { id: r.id }, data: { managerId: mona.id } });
  const jobs = await tx.vacancy.findMany({ where: { organizationId }, select: { branchId: true, vacancyRequestId: true } });
  const branchIds = [...new Set(jobs.map((j) => j.branchId))];
  for (const branchId of branchIds) await seedGradeBands(tx, organizationId, branchId);
  const g6 = await tx.masterDataValue.findFirst({ where: { organizationId, category: 'grades', name: 'Grade 6' } });
  if (g6) await tx.vacancyRequest.updateMany({ where: { id: { in: jobs.map((j) => j.vacancyRequestId) }, gradeId: null }, data: { gradeId: g6.id } });
}

/** M1: demo departments (master data 'departments'). Upsert by name: safe to run any number of times. */
const DEMO_DEPARTMENTS = ['IT', 'Nursing', 'Pharmacy', 'Finance', 'HR'];
async function seedDemoDepartments(organizationId) {
  for (const name of DEMO_DEPARTMENTS) {
    await prisma.masterDataValue.upsert({
      where: { organizationId_category_name: { organizationId, category: 'departments', name } },
      create: { organizationId, category: 'departments', name, code: `DEPT_${name.toUpperCase()}` },
      update: {},
    });
  }
}

// B6: minimal skill library (master data, category "skills"; metadata.category is optional).
async function seedSkillLibrary(tx, organizationId) {
  const skills = [
    ['ICU', 'Clinical'], ['Critical Care', 'Clinical'], ['Emergency Care', 'Clinical'], ['Triage', 'Clinical'],
    ['Pediatrics', 'Clinical'], ['Wound Care', 'Clinical'], ['IV Therapy', 'Clinical'],
    ['BLS', 'Certification'], ['ACLS', 'Certification'], ['BLS/ACLS', 'Certification'],
    ['Clinical Pharmacy', 'Pharmacy'], ['Dispensing', 'Pharmacy'],
    ['ICD-10', 'Medical Coding'], ['CPT', 'Medical Coding'], ['Revenue Cycle', 'Medical Coding'],
    ['MRI', 'Imaging'], ['CT Scan', 'Imaging'], ['PACS', 'Imaging'],
    ['HRIS', 'HR'], ['Active Directory', 'IT'], ['Networking', 'IT'],
    ['Clinical Experience', 'Clinical'], ['DHA/MOH License', 'Licensing'],
    ['Psychiatry', 'Clinical'], ['CBT', 'Clinical'], ['Endourology', 'Clinical'],
    ['Labor & Delivery', 'Clinical'], ['Fetal Monitoring', 'Clinical'],
  ];
  await tx.masterDataValue.createMany({
    data: skills.map(([name, category]) => ({ organizationId, category: 'skills', name, status: 'Active', metadata: { category } })),
    skipDuplicates: true,
  });
}

/** Canonical SGH WhatsApp defaults (same copy as WhatsAppTemplatesService). Idempotent by organization + name. */
const WHATSAPP_DEFAULTS = [
  {
    name: 'Application received — WhatsApp ack',
    category: 'ack',
    interviewType: 'Any',
    bodyTemplate: `Hi {{candidateName}},

Thank you for applying for {{positionTitle}} at {{organizationName}}. We have received your application and our team will review it shortly.

Best regards,
{{recruiterName}}
{{organizationName}} Recruitment`,
  },
  {
    name: 'Screening interview invite',
    category: 'interview_invite',
    interviewType: 'Screening',
    bodyTemplate: `Hi {{candidateName}},

We would like to invite you to a {{interviewType}} interview for {{positionTitle}} at {{organizationName}}.

Proposed time: {{interviewDate}}

Please reply on WhatsApp to confirm or suggest another slot.

Thank you,
{{recruiterName}}`,
  },
  {
    name: 'Technical interview invite',
    category: 'interview_invite',
    interviewType: 'Technical',
    bodyTemplate: `Hi {{candidateName}},

Please join us for a {{interviewType}} interview for {{positionTitle}} at {{organizationName}}.

Scheduled: {{interviewDate}}

Reply here to confirm. Looking forward to speaking with you.

{{recruiterName}}
{{organizationName}}`,
  },
  {
    name: 'Behavioral / panel interview invite',
    category: 'interview_invite',
    interviewType: 'Behavioral',
    bodyTemplate: `Hello {{candidateName}},

You are invited to a {{interviewType}} interview for {{positionTitle}} ({{organizationName}}).

Date/time: {{interviewDate}}

Please confirm availability on this chat.

Regards,
{{recruiterName}}`,
  },
  {
    name: 'Managerial interview invite',
    category: 'interview_invite',
    interviewType: 'Managerial',
    bodyTemplate: `Hi {{candidateName}},

Our hiring manager would like to meet you for a {{interviewType}} interview regarding {{positionTitle}} at {{organizationName}}.

Proposed: {{interviewDate}}

Kindly confirm via WhatsApp.

{{recruiterName}}`,
  },
  {
    name: 'Executive interview invite',
    category: 'interview_invite',
    interviewType: 'Executive',
    bodyTemplate: `Dear {{candidateName}},

We would like to invite you to an {{interviewType}} interview for {{positionTitle}} at {{organizationName}}.

Proposed time: {{interviewDate}}

Please confirm on WhatsApp at your earliest convenience.

Warm regards,
{{recruiterName}}
{{organizationName}}`,
  },
  {
    name: 'Offer / next-step WhatsApp',
    category: 'offer_next_step',
    interviewType: 'Any',
    bodyTemplate: `Hi {{candidateName}},

Great news regarding {{positionTitle}} at {{organizationName}}. We would like to discuss next steps / offer details with you.

I will share more shortly — please reply when you are available.

{{recruiterName}}
{{organizationName}} Recruitment`,
  },
  {
    name: 'Application not progressing',
    category: 'rejection',
    interviewType: 'Any',
    bodyTemplate: `Hi {{candidateName}},

Thank you for your interest in {{positionTitle}} at {{organizationName}}. After careful review, we will not be progressing your application at this time.

We appreciate your time and wish you every success.

{{recruiterName}}
{{organizationName}} Recruitment`,
  },
];

async function seedWhatsAppTemplates(tx, organizationId) {
  for (const row of WHATSAPP_DEFAULTS) {
    const existing = await tx.whatsAppTemplate.findFirst({
      where: { organizationId, name: row.name },
    });
    if (existing) {
      await tx.whatsAppTemplate.update({
        where: { id: existing.id },
        data: { ...row, status: 'Active', isDefault: true },
      });
    } else {
      await tx.whatsAppTemplate.create({
        data: { organizationId, ...row, status: 'Active', isDefault: true },
      });
    }
  }
}

function cairoParts(now) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const n = (type) => Number(parts.find((part) => part.type === type).value);
  return { y: n('year'), m: n('month'), d: n('day') };
}

function isoWeekKey(now) {
  const { y, m, d } = cairoParts(now);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/**
 * Current Cairo month and week targets for Sarah, Sindu, and Mona, set by Dr. Hassan Ali,
 * plus qualifying screenings, completed interviews, and submitted scorecards in that month.
 */
async function seedEmployeeActivityTargets(tx, organizationId) {
  const emails = [
    'sarah.ahmed@recruitflow.local',
    'sindu@recruitflow.local',
    'mona.manager@recruitflow.local',
    'hassan.ali@recruitflow.local',
  ];
  const people = await tx.user.findMany({ where: { organizationId, email: { in: emails } }, select: { id: true, email: true } });
  const byEmail = Object.fromEntries(people.map((person) => [person.email, person]));
  const sarah = byEmail['sarah.ahmed@recruitflow.local'];
  const sindu = byEmail['sindu@recruitflow.local'];
  const mona = byEmail['mona.manager@recruitflow.local'];
  const hassan = byEmail['hassan.ali@recruitflow.local'];
  if (!sarah || !sindu || !hassan) return;

  const now = new Date();
  const monthKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(now);
  const weekKey = isoWeekKey(now);
  const plans = [
    [sarah.id, 'screenings_completed', 'monthly', monthKey, 20],
    [sarah.id, 'interviews_conducted', 'monthly', monthKey, 8],
    [sarah.id, 'feedback_submitted', 'monthly', monthKey, 6],
    [sarah.id, 'seats_joined', 'monthly', monthKey, 2],
    [sarah.id, 'screenings_completed', 'weekly', weekKey, 5],
    [sarah.id, 'interviews_conducted', 'weekly', weekKey, 2],
    [sindu.id, 'screenings_completed', 'monthly', monthKey, 15],
    [sindu.id, 'interviews_conducted', 'monthly', monthKey, 6],
    [sindu.id, 'feedback_submitted', 'monthly', monthKey, 4],
    [sindu.id, 'seats_joined', 'monthly', monthKey, 1],
    [sindu.id, 'screenings_completed', 'weekly', weekKey, 4],
  ];
  if (mona) plans.push([mona.id, 'screenings_completed', 'monthly', monthKey, 4]);

  for (const [employeeId, metric, periodType, periodKey, targetQuantity] of plans) {
    const where = {
      organizationId_employeeId_metric_periodType_periodKey_scopeKey: {
        organizationId, employeeId, metric, periodType, periodKey, scopeKey: 'ALL',
      },
    };
    const existing = await tx.employeeActivityTarget.findUnique({ where });
    if (existing) continue;
    const created = await tx.employeeActivityTarget.create({
      data: {
        organizationId,
        employeeId,
        setById: hassan.id,
        metric,
        periodType,
        periodKey,
        vacancyId: null,
        scopeKey: 'ALL',
        targetQuantity,
        version: 1,
        isActive: true,
      },
    });
    await tx.employeeActivityTargetRevision.create({
      data: {
        targetId: created.id,
        organizationId,
        actorId: hassan.id,
        priorQuantity: null,
        newQuantity: targetQuantity,
        reason: 'Initial target assigned',
      },
    });
  }

  await tx.screeningLog.updateMany({
    where: { organizationId, screenerId: { in: [sarah.id, sindu.id] }, outcome: { not: '__discarded__' } },
    data: { screenedAt: now },
  });

  const ownedApps = await tx.application.findMany({
    where: { organizationId, primaryRecruiterId: { in: [sarah.id, sindu.id] } },
    select: { id: true, primaryRecruiterId: true },
    orderBy: { applicationCode: 'asc' },
  });
  const sarahApp = ownedApps.find((row) => row.primaryRecruiterId === sarah.id);
  const sinduApp = ownedApps.find((row) => row.primaryRecruiterId === sindu.id);
  const started = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const ended = new Date(now.getTime() - 60 * 60 * 1000);

  async function ensureConducted(code, applicationId, interviewerId, title) {
    if (!applicationId) return;
    const existing = await tx.interview.findUnique({ where: { interviewCode: code }, select: { id: true } });
    const interview = existing
      ? await tx.interview.update({
        where: { id: existing.id },
        data: { status: 'Completed', completedAt: now, scheduledStart: started, scheduledEnd: ended },
      })
      : await tx.interview.create({
        data: {
          organizationId,
          applicationId,
          interviewCode: code,
          title,
          interviewType: 'Video',
          scheduledStart: started,
          scheduledEnd: ended,
          timezone: 'Africa/Cairo',
          status: 'Completed',
          completedAt: now,
        },
      });
    const attendee = await tx.interviewAttendee.findUnique({ where: { interviewId_userId: { interviewId: interview.id, userId: interviewerId } } });
    if (!attendee) {
      await tx.interviewAttendee.create({ data: { interviewId: interview.id, userId: interviewerId, role: 'Interviewer', response: 'Accepted' } });
    } else if (attendee.response === 'Declined') {
      await tx.interviewAttendee.update({ where: { id: attendee.id }, data: { response: 'Accepted' } });
    }
    const card = await tx.interviewScorecard.findUnique({ where: { interviewId_interviewerId_revision: { interviewId: interview.id, interviewerId, revision: 1 } } });
    const cardData = { status: 'Submitted', submittedAt: now, overallRating: 4, recommendation: 'Hire', notes: 'Panel agreed to move forward.', strengths: 'Clear examples.' };
    if (card) await tx.interviewScorecard.update({ where: { id: card.id }, data: cardData });
    else await tx.interviewScorecard.create({ data: { interviewId: interview.id, interviewerId, revision: 1, ...cardData } });
  }

  await ensureConducted('INT-EAT-SARAH-01', sarahApp?.id, sarah.id, 'Panel interview');
  await ensureConducted('INT-EAT-SINDU-01', sinduApp?.id, sindu.id, 'Panel interview');

  const conducted = await tx.interview.findMany({
    where: {
      organizationId,
      status: 'Completed',
      attendees: { some: { userId: { in: [sarah.id, sindu.id] }, response: { not: 'Declined' } } },
    },
    select: { id: true },
  });
  if (conducted.length) {
    await tx.interview.updateMany({ where: { id: { in: conducted.map((row) => row.id) } }, data: { completedAt: now } });
    await tx.interviewScorecard.updateMany({
      where: {
        interviewerId: { in: [sarah.id, sindu.id] },
        status: 'Submitted',
        interviewId: { in: conducted.map((row) => row.id) },
      },
      data: { submittedAt: now },
    });
  }
}

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    // ── Organization ──────────────────────────────────────────
    const organization = await tx.organization.upsert({
      where: { code: 'RECRUITFLOW-DEMO' },
      update: {},
      create: {
        id: '10000000-0000-4000-8000-000000000001',
        code: 'RECRUITFLOW-DEMO',
        name: 'RecruitFlow Demo Organization',
      },
    });

    await seedRejectionReasons(tx, organization.id);
    await seedSkillLibrary(tx, organization.id);
    await seedDefaultPipeline(tx, organization.id);
    await seedWhatsAppTemplates(tx, organization.id);

    // ── Branch ────────────────────────────────────────────────
    const branch = await tx.branch.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: 'HEAD-OFFICE',
        },
      },
      update: {},
      create: {
        id: '10000000-0000-4000-8000-000000000002',
        organizationId: organization.id,
        code: 'HEAD-OFFICE',
        name: 'Head Office',
        country: 'EGY',
        city: 'Cairo',
      },
    });
    await seedGradeBands(tx, organization.id, branch.id);

    // ── Position ──────────────────────────────────────────────
    const position = await tx.position.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: 'SSE',
        },
      },
      update: {},
      create: {
        id: '10000000-0000-4000-8000-000000000003',
        organizationId: organization.id,
        code: 'SSE',
        title: 'Senior Software Engineer',
      },
    });

    // ── Additional Positions ──────────────────────────────────
    await tx.position.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: 'SR-PHARM' } },
      update: {},
      create: {
        organizationId: organization.id,
        code: 'SR-PHARM',
        title: 'Senior Pharmacist',
        description: 'Licensed pharmacist for retail pharmacy operations.',
      },
    });

    await tx.position.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: 'FE-ENG' } },
      update: {},
      create: {
        organizationId: organization.id,
        code: 'FE-ENG',
        title: 'Frontend Engineer',
        description: 'React/TypeScript frontend developer.',
      },
    });

    await tx.position.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: 'HR-SPEC' } },
      update: {},
      create: {
        organizationId: organization.id,
        code: 'HR-SPEC',
        title: 'HR Specialist',
        description: 'Human resources operations specialist.',
      },
    });

    await tx.position.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: 'SALES-EXEC' } },
      update: {},
      create: {
        organizationId: organization.id,
        code: 'SALES-EXEC',
        title: 'Sales Executive',
        description: 'Field sales and business development.',
      },
    });

    // ── Users (matching reference screen 39) ──────────────────
    const users = {};

    const userSeed = [
      {
        id: '10000000-0000-4000-8000-000000000004',
        email: 'ahmed.mahmoud@recruitflow.local',
        displayName: 'Ahmed Mahmoud',
      },
      {
        id: '10000000-0000-4000-8000-000000000008',
        email: 'tarek.audit@recruitflow.local',
        displayName: 'Tarek Nabil',
      },
      {
        id: '10000000-0000-4000-8000-000000000009',
        email: 'mona.manager@recruitflow.local',
        displayName: 'Mona El-Sayed',
      },
      {
        id: '10000000-0000-4000-8000-000000000010',
        email: 'sarah.ahmed@recruitflow.local',
        displayName: 'Sarah Ahmed',
      },
      {
        id: '10000000-0000-4000-8000-000000000011',
        email: 'hassan.ali@recruitflow.local',
        displayName: 'Hassan Ali',
        jobTitle: 'Hiring Manager',
      },
      {
        id: '10000000-0000-4000-8000-000000000012',
        email: 'aya.mostafa@recruitflow.local',
        displayName: 'Aya Mostafa',
      },
      {
        id: '10000000-0000-4000-8000-000000000013',
        email: 'omar.nasser@recruitflow.local',
        displayName: 'Omar Nasser',
      },
      // System Administrator
      {
        id: '10000000-0000-4000-8000-000000000000',
        email: 'admin@sgh.com',
        displayName: 'System Administrator',
      },
    ];

    for (const u of userSeed) {
      users[u.email] = await tx.user.upsert({
        where: { id: u.id },
        update: {
          email: u.email,
          emailNormalized: u.email,
          displayName: u.displayName,
          jobTitle: u.jobTitle ?? null,
          branchId: branch.id,
          passwordHash: DEFAULT_PASSWORD_HASH,
        },
        create: {
          id: u.id,
          organizationId: organization.id,
          email: u.email,
          emailNormalized: u.email,
          displayName: u.displayName,
          jobTitle: u.jobTitle ?? null,
          branchId: branch.id,
          passwordHash: DEFAULT_PASSWORD_HASH,
        },
      });
    }

    // ── Roles (matching reference screen 39) ──────────────────
    const roles = {};

    const roleSeed = [
      { code: 'ADMINISTRATOR', name: 'Administrator' },
      { code: 'PERFORMANCE_ADMIN', name: 'Performance Admin' },
      { code: 'TALENT_MANAGER', name: 'Talent Manager' },
      { code: 'RECRUITER', name: 'Recruiter' },
      { code: 'HR_MANAGER', name: 'HR Manager' },
      { code: 'HIRING_MANAGER', name: 'Hiring Manager' },
      { code: 'INTERVIEWER', name: 'Interviewer' },
      { code: 'HR_OPERATIONS', name: 'HR Operations' },
      { code: 'LICENSE_SPECIALIST', name: 'License Specialist' },
      { code: 'OFFER_APPROVER', name: 'Offer Approver' },
      { code: 'FINAL_HIRING_APPROVER', name: 'Final Hiring Approver' },
      { code: 'VIEWER', name: 'Viewer' },
    ];

    for (const r of roleSeed) {
      roles[r.code] = await tx.role.upsert({
        where: { code: r.code },
        update: { name: r.name },
        create: { code: r.code, name: r.name },
      });
    }

    // Remove old RECRUITMENT_ADMIN role if it still exists
    const oldRole = await tx.role.findUnique({ where: { code: 'RECRUITMENT_ADMIN' } });
    if (oldRole) {
      await tx.rolePermission.deleteMany({ where: { roleId: oldRole.id } });
      await tx.userRole.deleteMany({ where: { roleId: oldRole.id } });
      await tx.role.delete({ where: { code: 'RECRUITMENT_ADMIN' } });
    }

    // ── Permissions ───────────────────────────────────────────
    const permissions = {};

    const permSeed = [
      // Vacancy
      { code: 'VACANCY_REQUEST_VIEW', description: 'View vacancy requests.' },
      { code: 'VACANCY_REQUEST_CREATE', description: 'Create vacancy requests.' },
      { code: 'VACANCY_REQUEST_APPROVE', description: 'Approve vacancy requests in the workflow.' },
      { code: 'VACANCY_VIEW', description: 'View vacancies.' },
      { code: 'VACANCY_MANAGE', description: 'Manage vacancies (activate, assign, hold, cancel).' },
      { code: 'VACANCY_ASSIGN', name: 'Assign vacancy team', description: 'Assign a vacancy to a primary or supporting recruiter.' },
      { code: 'VACANCY_REASSIGN', name: 'Reassign vacancy team', description: 'Replace the active primary recruiter assigned to a vacancy.' },
      // Users & Roles
      { code: 'USERS_VIEW', description: 'View user list and details.' },
      { code: 'USERS_MANAGE', description: 'Create, edit, and deactivate users.' },
      { code: 'ROLES_VIEW', description: 'View roles and permissions.' },
      { code: 'ROLES_MANAGE', description: 'Create, edit roles and assign permissions.' },
      // Master Data
      { code: 'MASTER_DATA_VIEW', description: 'View master data (organizations, branches, positions).' },
      { code: 'MASTER_DATA_MANAGE', description: 'Create and edit master data records.' },
      // Audit
      { code: 'AUDIT_VIEW', description: 'View audit log entries.' },
      // Candidate & Application
      { code: 'CANDIDATE_VIEW', description: 'View candidate profile and list.' },
      { code: 'CANDIDATE_CREATE', description: 'Create candidate records.' },
      { code: 'CANDIDATE_EDIT', description: 'Edit candidate profile details.' },
      // B2: hard delete retired; legal erasure is anonymize (Administrator only).
      { code: 'CANDIDATE_ANONYMIZE', name: 'Anonymize candidate (legal erasure)', description: "Irreversibly replace a candidate's personal data with placeholders. Administrator only." },
      { code: 'APPLICATION_VIEW', description: 'View recruitment applications.' },
      { code: 'APPLICATION_CREATE', description: 'Apply candidate to a vacancy.' },
      { code: 'APPLICATION_MOVE_STAGE', description: 'Advance or move application stage.' },
      // Sensitive fields
      { code: 'VIEW_CANDIDATE_PII', description: 'View candidate personally identifiable information.' },
      { code: 'VIEW_CURRENT_SALARY', description: 'View candidate current salary details.' },
      { code: 'APPROVE_OFFERS', description: 'Approve offer packages and salary bands.' },
      // B7: offer pay (base, package, component amounts); distinct from VIEW_CURRENT_SALARY.
      { code: 'OFFER_PAY_VIEW', name: 'View offer pay', description: 'See offer base pay, package and component amounts. Current/expected salary still needs VIEW_CURRENT_SALARY.' },
      { code: 'DOWNLOAD_DOCUMENTS', description: 'Download private candidate and hiring documents.' },
      { code: 'FINAL_HIRING_APPROVAL', description: 'Perform final hiring approval gate.' },
      { code: 'RECORD_ACTUAL_JOINING', name: 'Record actual joining', description: 'Record that an approved candidate actually joined. Does not grant final hiring approval.' },
      { code: 'OVERRIDE_WORKFLOW', description: 'Override workflow rules and bypass validations.' },
      // Notifications & Tasks (Phase 10)
      { code: 'NOTIFICATION_VIEW', description: 'View own notifications and manage read status.' },
      { code: 'TASK_VIEW', description: 'View tasks assigned to the current user.' },
      { code: 'TASK_UPDATE_STATUS', description: 'Update the status of an assigned task.' },
      // C2: named now, wired in B0b (no endpoint checks them yet)
      { code: 'INTERVIEW_PARTICIPATE', name: 'Participate in interviews', description: 'Be scheduled on interviews and submit scorecards for interviews you attend.' },
      { code: 'LICENSE_CHECK', name: 'Check professional licenses', description: "Record and verify a candidate's professional license check (e.g. nursing, pharmacy)." },
    ];

    for (const p of permSeed) {
      permissions[p.code] = await tx.permission.upsert({
        where: { code: p.code },
        update: { ...(p.name ? { name: p.name } : {}), description: p.description },
        create: { code: p.code, ...(p.name ? { name: p.name } : {}), description: p.description },
      });
    }

    // B2: CANDIDATE_DELETE is retired (kept for history, never effective).
    await tx.permission.updateMany({ where: { code: 'CANDIDATE_DELETE' }, data: { status: 'Retired' } });

    // ── Role → Permission assignments ─────────────────────────
    const rolePermMap = {
      // Administrator gets everything except offer pay (B7, v2 §7: pay visible to Manager only).
      ADMINISTRATOR: Object.keys(permissions).filter((code) => code !== 'OFFER_PAY_VIEW'),
      PERFORMANCE_ADMIN: [
        'VACANCY_REQUEST_VIEW',
        'VACANCY_VIEW',
        'CANDIDATE_VIEW',
        'APPLICATION_VIEW',
        'MASTER_DATA_VIEW',
        'AUDIT_VIEW',
        'NOTIFICATION_VIEW',
      ],
      TALENT_MANAGER: [
        'VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_CREATE', 'VACANCY_REQUEST_APPROVE',
        'VACANCY_VIEW', 'VACANCY_MANAGE',
        'VACANCY_ASSIGN', 'VACANCY_REASSIGN',
        'MASTER_DATA_VIEW',
        'CANDIDATE_VIEW', 'CANDIDATE_CREATE', 'CANDIDATE_EDIT',
        'APPLICATION_VIEW', 'APPLICATION_CREATE', 'APPLICATION_MOVE_STAGE',
        'VIEW_CANDIDATE_PII', 'VIEW_CURRENT_SALARY', 'APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL', 'OFFER_PAY_VIEW',
        'DOWNLOAD_DOCUMENTS',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      RECRUITER: [
        // B2-3: Employees (RECRUITER) do not create or list requisitions (v2 §5).
        'VACANCY_VIEW',
        'MASTER_DATA_VIEW',
        'CANDIDATE_VIEW', 'CANDIDATE_CREATE', 'CANDIDATE_EDIT',
        'APPLICATION_VIEW', 'APPLICATION_CREATE', 'APPLICATION_MOVE_STAGE',
        'VIEW_CANDIDATE_PII', 'DOWNLOAD_DOCUMENTS', 'RECORD_ACTUAL_JOINING',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      HR_MANAGER: [
        'VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_CREATE', 'VACANCY_REQUEST_APPROVE',
        'VACANCY_VIEW', 'VACANCY_MANAGE',
        'VACANCY_ASSIGN', 'VACANCY_REASSIGN',
        'USERS_VIEW', 'USERS_MANAGE', 'ROLES_VIEW',
        'MASTER_DATA_VIEW', 'MASTER_DATA_MANAGE',
        'AUDIT_VIEW',
        'CANDIDATE_VIEW', 'CANDIDATE_CREATE', 'CANDIDATE_EDIT',
        'APPLICATION_VIEW', 'APPLICATION_CREATE', 'APPLICATION_MOVE_STAGE',
        'VIEW_CANDIDATE_PII', 'VIEW_CURRENT_SALARY', 'APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL', 'OFFER_PAY_VIEW',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      HIRING_MANAGER: [
        'VACANCY_REQUEST_VIEW', 'VACANCY_REQUEST_CREATE', 'VACANCY_REQUEST_APPROVE',
        'VACANCY_VIEW',
        'MASTER_DATA_VIEW',
        'CANDIDATE_VIEW', 'APPLICATION_VIEW', 'APPLICATION_MOVE_STAGE', 'APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL', 'OFFER_PAY_VIEW',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      INTERVIEWER: [
        'VACANCY_VIEW',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      HR_OPERATIONS: [
        'VACANCY_REQUEST_VIEW', 'VACANCY_VIEW',
        'MASTER_DATA_VIEW',
        'USERS_VIEW',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      LICENSE_SPECIALIST: [
        'VACANCY_VIEW',
        'LICENSE_CHECK',
        'DOWNLOAD_DOCUMENTS',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      OFFER_APPROVER: [
        'VACANCY_VIEW',
        'APPROVE_OFFERS',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      FINAL_HIRING_APPROVER: [
        'VACANCY_VIEW',
        'FINAL_HIRING_APPROVAL',
        'VIEW_CANDIDATE_PII',
        'DOWNLOAD_DOCUMENTS',
        'NOTIFICATION_VIEW', 'TASK_VIEW', 'TASK_UPDATE_STATUS',
      ],
      VIEWER: [
        'VACANCY_REQUEST_VIEW',
        'VACANCY_VIEW',
        'MASTER_DATA_VIEW',
        'NOTIFICATION_VIEW', 'TASK_VIEW',
      ],
    };

    for (const [roleCode, permCodes] of Object.entries(rolePermMap)) {
      const role = roles[roleCode];
      if (!role) continue;
      for (const permCode of permCodes) {
        const permission = permissions[permCode];
        if (!permission) continue;
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: permission.id },
          },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }
    }

    // ── User → Role assignments ───────────────────────────────
    const userRoleMap = {
      'ahmed.mahmoud@recruitflow.local': 'ADMINISTRATOR',
      'tarek.audit@recruitflow.local': 'PERFORMANCE_ADMIN',
      'mona.manager@recruitflow.local': 'TALENT_MANAGER',
      'sarah.ahmed@recruitflow.local': 'RECRUITER',
      'hassan.ali@recruitflow.local': 'HIRING_MANAGER',
      'aya.mostafa@recruitflow.local': 'FINAL_HIRING_APPROVER',
      'omar.nasser@recruitflow.local': 'LICENSE_SPECIALIST',
      'admin@sgh.com': 'ADMINISTRATOR',
    };

    for (const [email, roleCode] of Object.entries(userRoleMap)) {
      const user = users[email];
      const role = roles[roleCode];
      if (!user || !role) continue;
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }

    // ── Sample Candidates & Applications ─────────────────────
    const candidateSeed = [
      { code: 'C001', firstName: 'John', lastName: 'Doe', email: 'john@demo.com', phone: '1234', currentTitle: 'Frontend Dev', currentCompany: 'A', source: 'Web' },
      { code: 'C002', firstName: 'Jane', lastName: 'Ali', email: 'jane@demo.com', phone: '1234', currentTitle: 'Backend Dev', currentCompany: 'B', source: 'Web' },
      { code: 'C003', firstName: 'Omar', lastName: 'Sam', email: 'omar@demo.com', phone: '1234', currentTitle: 'DevOps Eng', currentCompany: 'C', source: 'Web' },
      { code: 'C004', firstName: 'Sara', lastName: 'Kim', email: 'sara@demo.com', phone: '1234', currentTitle: 'QA Engineer', currentCompany: 'D', source: 'Web' },
      { code: 'C005', firstName: 'Adam', lastName: 'Zaz', email: 'adam@demo.com', phone: '1234', currentTitle: 'Product Mgr', currentCompany: 'E', source: 'Web' },
      { code: 'C006', firstName: 'Dina', lastName: 'Baz', email: 'dina@demo.com', phone: '1234', currentTitle: 'UI Designer', currentCompany: 'F', source: 'Web' },
    ];

    for (let i = 0; i < candidateSeed.length; i++) {
      const c = candidateSeed[i];
      const candId = `10000000-0000-4000-9000-00000000000${i+1}`;
      const cand = await tx.candidate.upsert({
        where: { organizationId_email: { organizationId: organization.id, email: c.email } },
        update: { firstName: c.firstName, lastName: c.lastName, currentTitle: c.currentTitle },
        create: {
          id: candId,
          organizationId: organization.id,
          candidateCode: c.code,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          currentTitle: c.currentTitle,
          currentCompany: c.currentCompany,
          source: c.source,
          status: 'Active',
        },
      });

      // Add dummy CV document
      const docId = `20000000-0000-4000-9000-00000000000${i+1}`;
      const existingDoc = await tx.candidateDocument.findUnique({ where: { id: docId } });
      if (!existingDoc) {
        await tx.candidateDocument.create({
          data: {
            id: docId,
            organizationId: organization.id,
            candidateId: cand.id,
            documentType: 'CV',
            fileName: `${c.firstName}_CV.pdf`,
            fileSize: 102400,
            mimeType: 'application/pdf',
            storageKey: `cvs/${organization.id}/${cand.id}/cv.pdf`,
            storageProvider: 'local-private',
            scanStatus: 'Clean',
            consentStatus: 'Active',
          }
        });
      }
    }

    const demo = await seedDemoFixtures(tx, { organization, branch, position, users });
    await seedDecisionDemo(tx, organization.id, users);
    await seedEmployeeActivityTargets(tx, organization.id);

    // ── Organization B (for Cross-Tenant Isolation Testing) ─────
    const orgB = await tx.organization.upsert({
      where: { code: 'ACME-CORP' },
      update: {},
      create: {
        id: '20000000-0000-4000-8000-000000000001',
        code: 'ACME-CORP',
        name: 'Acme Global Healthcare',
      },
    });
    await seedRejectionReasons(tx, orgB.id);
    await seedWhatsAppTemplates(tx, orgB.id);

    const branchB = await tx.branch.upsert({
      where: { organizationId_code: { organizationId: orgB.id, code: 'ACME-ALEX' } },
      update: {},
      create: {
        id: '20000000-0000-4000-8000-000000000002',
        organizationId: orgB.id,
        code: 'ACME-ALEX',
        name: 'Alexandria Medical Branch',
        country: 'EGY',
        city: 'Alexandria',
      },
    });

    const positionB = await tx.position.upsert({
      where: { organizationId_code: { organizationId: orgB.id, code: 'MED-DIR' } },
      update: {},
      create: {
        id: '20000000-0000-4000-8000-000000000003',
        organizationId: orgB.id,
        code: 'MED-DIR',
        title: 'Medical Director',
      },
    });

    const userB = await tx.user.upsert({
      where: { id: '20000000-0000-4000-8000-000000000004' },
      update: { passwordHash: DEFAULT_PASSWORD_HASH, branchId: branchB.id },
      create: {
        id: '20000000-0000-4000-8000-000000000004',
        organizationId: orgB.id,
        email: 'tarek.kamal@acme-health.local',
        emailNormalized: 'tarek.kamal@acme-health.local',
        passwordHash: DEFAULT_PASSWORD_HASH,
        displayName: 'Tarek Kamal',
        branchId: branchB.id,
        status: 'Active',
      },
    });

    // Assign roles to User B
    const adminRole = roles['ADMINISTRATOR'];
    if (adminRole) {
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: userB.id, roleId: adminRole.id } },
        update: {},
        create: { userId: userB.id, roleId: adminRole.id },
      });
    }

    const candidateB = await tx.candidate.upsert({
      where: { organizationId_email: { organizationId: orgB.id, email: 'mona.zaki@example.com' } },
      update: { firstName: 'Mona', lastName: 'Zaki' },
      create: {
        id: '20000000-0000-4000-8000-000000000020',
        organizationId: orgB.id,
        candidateCode: 'CND-ACME-001',
        firstName: 'Mona',
        lastName: 'Zaki',
        email: 'mona.zaki@example.com',
        phone: '+201099887766',
        currentTitle: 'Chief Medical Officer',
        currentCompany: 'Alex Hospital',
        source: 'Executive Search',
        status: 'Active',
      },
    });

    return { organization, branch, position, users, roles, demo, orgB, userB, candidateB, branchB };
  }, { maxWait: 20000, timeout: 180000 });

  for (const org of await prisma.organization.findMany({ select: { id: true } })) { await seedReasonLists(org.id); await seedDemoDepartments(org.id); }
  await resyncCodeSequences();

  console.log(
    JSON.stringify({
      seeded: true,
      organizationId: result.organization.id,
      branchId: result.branch.id,
      positionId: result.position.id,
      users: Object.keys(result.users).length,
      roles: Object.keys(result.roles).length,
      demo: result.demo,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
