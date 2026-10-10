/** Fixtures in the exact B6 #13 shapes. Includes score/pay/contact fields a bad server might send, to prove they never render. */
const ev = (id: string, sourceType: string, snippet: string, addedAt: string, sourceRef: string | null = null) => ({ id, sourceType, sourceRef, snippet, addedBy: { id: 'u-mariam', name: 'Mariam Farag' }, addedAt });
const sk = (id: string, name: string) => ({ id, name });
export const HRIS = sk('s1', 'HRIS'); export const PAYROLL = sk('s2', 'Payroll'); export const ORACLE = sk('s3', 'Oracle');
export const suggestions = {
  vacancyId: 'v1', requiredSkills: [HRIS, PAYROLL, ORACLE], unmappedRequiredSkills: ['Arabic payroll law'],
  orderedBy: ['required skills with at least one piece of evidence (more first)', 'required skills held, with or without evidence (more first)', 'most recent evidence (newer first)', 'candidate last updated (newer first)', 'candidate code (A-Z)'],
  suggestions: [
    { candidate: { id: 'c-heba', code: 'CAN-2026-0031', name: 'Heba Mansour', currentTitle: 'Payroll Specialist', location: 'Cairo', score: 0.93, matchPercent: 93, expectedSalary: 42000, email: 'heba@x.test' },
      matchedSkills: [
        { skill: HRIS, hasEvidence: true, evidence: [ev('e1', 'SCREENING_NOTE', 'Owned HRIS master data for 2,000 staff.', '2026-07-12T09:00:00Z')] },
        { skill: PAYROLL, hasEvidence: true, evidence: [ev('e2', 'CV', 'Oracle HCM payroll consultant for 4 years at Elsewedy.', '2026-07-01T09:00:00Z', 'heba-cv.pdf')] },
        { skill: ORACLE, hasEvidence: true, evidence: [] },
      ], missingSkills: [] },
    { candidate: { id: 'c-youssef', code: 'CAN-2026-0044', name: 'Youssef Nabil', currentTitle: 'HR Systems Analyst', location: 'Giza' },
      matchedSkills: [
        { skill: HRIS, hasEvidence: true, evidence: [ev('e3', 'CV', 'Built Oracle EBS HR reports for 3 sites.', '2026-08-02T09:00:00Z')] },
        { skill: ORACLE, hasEvidence: true, evidence: [] },
        { skill: PAYROLL, hasEvidence: false, evidence: [] },
      ], missingSkills: [] },
    { candidate: { id: 'c-amr', code: 'CAN-2026-0050', name: 'Amr Fathy', currentTitle: 'HR Officer', location: null },
      matchedSkills: [{ skill: HRIS, hasEvidence: false, evidence: [] }], missingSkills: [PAYROLL, ORACLE], alreadyOnJob: false, stage: null, addable: true },
    { candidate: { id: 'c-a4', code: 'CAN-2026-0007', name: 'Nourhan Sami', currentTitle: 'HRIS Analyst', location: 'Cairo' },
      matchedSkills: [{ skill: HRIS, hasEvidence: true, evidence: [ev('e12', 'NOTE', 'HRIS data owner on SAP SuccessFactors for 1,200 staff.', '2026-09-28T09:00:00Z', 'referral note')] }], missingSkills: [PAYROLL, ORACLE], alreadyOnJob: true, stage: 'Screening', addable: false },
  ],
};
export const compare = {
  vacancyId: 'v1',
  candidates: [{ id: 'c-a7', code: 'CAN-2026-0002', name: 'Ahmed Embaby', currentTitle: 'Laravel Developer', location: 'Cairo' }, { id: 'c-a4', code: 'CAN-2026-0007', name: 'Nourhan Sami', currentTitle: 'HRIS Analyst', location: 'Cairo' }],
  rows: [
    { skill: HRIS, cells: [{ candidateId: 'c-a7', status: 'evidence', evidence: [ev('e9', 'CV', 'Maintained in-house HRIS modules (leave, attendance) in Laravel at Vezeeta.', '2026-09-30T09:00:00Z')] }, { candidateId: 'c-a4', status: 'evidence', evidence: [ev('e10', 'NOTE', 'HRIS data owner on SAP SuccessFactors for 1,200 staff.', '2026-09-28T09:00:00Z', 'referral note')] }] },
    { skill: PAYROLL, cells: [{ candidateId: 'c-a7', status: 'no-evidence', evidence: [] }, { candidateId: 'c-a4', status: 'evidence', evidence: [ev('e11', 'CV', 'Ran monthly payroll for 1,200 staff at Cleopatra Hospitals.', '2026-09-28T09:00:00Z')] }] },
    { skill: ORACLE, cells: [{ candidateId: 'c-a7', status: 'missing', evidence: [] }, { candidateId: 'c-a4', status: 'no-evidence', evidence: [] }] },
  ],
  infoRows: [
    { key: 'notice-period', label: 'Notice period', cells: [{ candidateId: 'c-a7', value: 30, source: 'screening', at: '2026-10-01T09:00:00Z' }, { candidateId: 'c-a4', value: 'Immediately', source: 'profile' }] },
    { key: 'fit-note', label: 'Fit note', cells: [{ candidateId: 'c-a7', value: 'Strong Laravel; HRIS from leave/attendance only.', source: 'screening', by: { id: 'u-mariam', name: 'Mariam Farag' }, at: '2026-10-01T09:00:00Z' }, { candidateId: 'c-a4', value: null, source: null, by: null, at: null }] },
  ],
  overallScore: 77,
};
const app = (id: string, cid: string, first: string, last: string, stage: string, job: string, vac: string, extra: Record<string, unknown> = {}) => ({
  id, candidateId: cid, vacancyId: vac, stage, source: 'LinkedIn', positionTitle: job, primaryRecruiterName: 'Mariam Farag', lastActivityLabel: null, nextFollowUpAt: null,
  candidate: { firstName: first, lastName: last, currentTitle: 'Laravel, HRIS', experienceYears: 6, email: `${first}@x.test`, phone: '+20 100 000', expectedSalary: 42000, nationalId: '29001010101010' }, ...extra,
});
export const myApplications = { data: [
  app('a7', 'c-a7', 'Ahmed', 'Embaby', 'Interview', 'HRIS Developer', 'v1', { lastActivityLabel: 'Scorecard missing' }),
  app('a4', 'c-a4', 'Nourhan', 'Sami', 'Screening', 'HRIS Developer', 'v1', { source: 'Referral', lastActivityLabel: 'Log screening today' }),
  app('a10', 'c-a10', 'Lina', 'Hassan', 'Offer', 'HRIS Developer', 'v1', { source: 'Careers site', lastActivityLabel: 'Waiting on Karim Hassan' }),
  app('a6', 'c-a6', 'Salma', 'Adel', 'Screening', 'HRIS Developer', 'v1', { source: 'Careers site', nextFollowUpAt: '2026-10-07T07:00:00Z' }),
  app('b2', 'c-b2', 'Ahmed', 'Saleh', 'Screening', 'Laravel Backend Engineer', 'v2', { lastActivityLabel: 'Screening booked 14 Oct' }),
  app('a14', 'c-a14', 'Hoda', 'Saleh', 'Joined', 'HRIS Developer', 'v1'),
] };
export const bank = { data: [
  { id: 'c-heba', candidateCode: 'CAN-2026-0031', firstName: 'Heba', lastName: 'Mansour', currentTitle: 'Payroll Specialist', location: 'Cairo', experienceYears: 7, status: 'Active', email: 'heba@x.test', phone: '+20 1', expectedSalary: 50000 },
  { id: 'c-youssef', candidateCode: 'CAN-2026-0044', firstName: 'Youssef', lastName: 'Nabil', currentTitle: 'HR Systems Analyst', location: 'Giza', experienceYears: 5, status: 'Active' },
] };
