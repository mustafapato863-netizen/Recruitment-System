/**
 * Test/screenshot-only API responses in the #11 shapes (never imported by product code).
 * Deliberately include pay fields everywhere the real API could send them, so the
 * pay-safety tests prove they are stripped.
 */
export type Scenario = 'applied' | 'screened' | 'interview' | 'scored' | 'offer-pending' | 'offer-approved' | 'offer-sent' | 'offer-accepted' | 'prehire' | 'prehire-done' | 'rejected';

const T = '2026-10-';
export function fileResponses(scenario: Scenario, opts: { me?: string } = {}): Record<string, unknown> {
  const me = opts.me ?? 'u-mariam';
  const stage = ({ applied: 'Applied', screened: 'Screening', interview: 'Interview', scored: 'Interview', 'offer-pending': 'Offer', 'offer-approved': 'Offer', 'offer-sent': 'Offer', 'offer-accepted': 'Offer', prehire: 'Pre-Hire', 'prehire-done': 'Pre-Hire', rejected: 'Rejected' } as const)[scenario];
  const order = ['applied', 'screened', 'interview', 'scored', 'offer-pending', 'offer-approved', 'offer-sent', 'offer-accepted', 'prehire', 'prehire-done'];
  const at = (s: Scenario) => scenario !== 'rejected' && order.indexOf(scenario) >= order.indexOf(s);
  const application = {
    id: 'a1', organizationId: 'o', applicationCode: 'APP-1042', vacancyId: 'j1', vacancyLocation: 'Offshore Cairo', vacancyBranchName: 'Offshore Cairo',
    candidateId: 'c1', stage, allowedTransitions: [], version: 7, source: 'LinkedIn', primaryRecruiterId: me, primaryRecruiterName: 'Mariam Farag',
    candidate: { id: 'c1', firstName: 'Ahmed', lastName: 'Embaby', email: 'ahmed.embaby@example.com', phone: '+20 111 204 8890', expectedSalary: 42000, currentSalary: 35000, salaryCurrency: 'EGP' },
    vacancyCode: 'VAC-1', positionTitle: 'HRIS Developer', nextFollowUpAt: `${T}12T09:00:00.000Z`, rejectionReason: scenario === 'rejected' ? 'Not enough experience' : null,
    appliedAt: `${T}01T08:00:00.000Z`, createdAt: `${T}01T08:00:00.000Z`, updatedAt: `${T}09T08:00:00.000Z`,
    expectedSalary: 42000,
  };
  const screening = at('screened') ? [{ id: 's1', organizationId: 'o', applicationId: 'a1', screenerId: me, screenerName: 'Mariam Farag', outcome: 'Passed', notes: 'Strong Laravel and HRIS module work; built leave and payroll exports at Vezeeta.', noticePeriodDays: 30, expectedSalary: 42000, currentSalary: 35000, salaryCurrency: 'EGP', screenedAt: `${T}02T10:00:00.000Z`, createdAt: `${T}02T10:00:00.000Z` }] : [];
  const interviews = at('interview') ? [{ id: 'iv1', organizationId: 'o', interviewCode: 'INT-9', applicationId: 'a1', title: 'Technical interview: Ahmed Embaby', interviewType: 'Technical', scheduledStart: `${T}06T07:00:00.000Z`, scheduledEnd: `${T}06T08:00:00.000Z`, timezone: 'Africa/Cairo', locationUrl: 'https://teams.microsoft.com/l/meetup-join/sg4', roomName: null, interviewerName: 'Karim Hassan', status: 'Completed' }] : [];
  const scorecards = at('scored') ? [{ id: 'sc1', interviewId: 'iv1', interviewerId: 'u-karim', interviewerName: 'Karim Hassan', overallRating: 4, recommendation: 'Hire', strengths: 'HRIS depth', concerns: 'No Oracle', notes: 'Walked through payroll export design.', status: 'Submitted', revision: 1, isLocked: true, submittedAt: `${T}06T09:00:00.000Z` }] : [];
  const offerStatus = scenario === 'offer-pending' ? 'Pending Approval' : scenario === 'offer-approved' ? 'Approved' : scenario === 'offer-sent' ? 'Sent' : 'Accepted';
  const version = { id: 'ov1', offerId: 'o1', versionNumber: 1, status: offerStatus, approvalStatus: offerStatus === 'Pending Approval' ? 'Pending' : 'Approved', isLocked: offerStatus !== 'Pending Approval',
    monthlyPackage: 42000, annualFixed: 504000, contractType: 'Full-time · 2 years', probationPeriod: '3 months', offerExpiry: `${T}20`, proposedJoiningDate: `2026-11-01`, workLocation: 'Offshore Cairo', workingSchedule: null,
    components: [{ id: 'cp1', type: 'Salary', name: 'Basic', amount: 30000, currency: 'EGP', isTaxable: true }], approvals: [{ id: 'ap1', status: offerStatus === 'Pending Approval' ? 'Pending' : 'Approved', approverName: 'Karim Hassan', roleCode: 'OFFER_APPROVER' }], createdAt: `${T}07T09:00:00.000Z` };
  const offer = at('offer-pending') ? { id: 'o1', organizationId: 'o', applicationId: 'a1', offerCode: 'OFF-2026-0012', status: offerStatus, currentVersionId: 'ov1', currentVersion: version, versions: [version], packageTotal: 504000, createdAt: `${T}07T09:00:00.000Z`, updatedAt: `${T}08T09:00:00.000Z` } : null;
  const reqs = [
    { id: 'r-id', type: 'Document', name: 'National ID', status: scenario === 'prehire-done' ? 'Verified' : 'Verified', isRequired: true },
    { id: 'r-ct', type: 'Document', name: 'Signed contract', status: scenario === 'prehire-done' ? 'Verified' : 'Pending', isRequired: true },
    { id: 'r-lic', type: 'Licence', name: 'SCFHS licence', status: scenario === 'prehire-done' ? 'Verified' : 'Pending', isRequired: true },
  ];
  const hiring = at('prehire') ? [{ id: 'h1', organizationId: 'o', applicationId: 'a1', offerId: 'o1', status: 'In Progress', packageTotal: 504000, complianceRequirements: reqs, createdAt: `${T}09T09:00:00.000Z`, updatedAt: `${T}09T09:00:00.000Z` }] : [];
  const history = [
    { id: 'h0', applicationId: 'a1', fromStage: null, toStage: 'Applied', changedByName: 'Mariam Farag', reason: 'Applied via LinkedIn', createdAt: `${T}01T08:00:00.000Z` },
    ...(at('screened') ? [{ id: 'h1', applicationId: 'a1', fromStage: 'Applied', toStage: 'Screening', changedByName: 'Mariam Farag', createdAt: `${T}02T09:00:00.000Z` }] : []),
    ...(at('interview') ? [{ id: 'h2', applicationId: 'a1', fromStage: 'Screening', toStage: 'Interview', changedByName: 'Mariam Farag', createdAt: `${T}03T09:00:00.000Z` }] : []),
    ...(at('offer-pending') ? [{ id: 'h3', applicationId: 'a1', fromStage: 'Interview', toStage: 'Offer', changedByName: 'Mariam Farag', createdAt: `${T}07T08:00:00.000Z` }] : []),
    ...(at('prehire') ? [{ id: 'h4', applicationId: 'a1', fromStage: 'Offer', toStage: 'Pre-Hire', changedByName: 'Mariam Farag', createdAt: `${T}09T08:00:00.000Z` }] : []),
    ...(scenario === 'rejected' ? [{ id: 'h9', applicationId: 'a1', fromStage: 'Applied', toStage: 'Rejected', changedByName: 'Mariam Farag', reason: 'Not enough experience', createdAt: `${T}03T08:00:00.000Z` }] : []),
  ];
  const notes = [{ id: 'n1', organizationId: 'o', applicationId: 'a1', authorId: me, authorName: 'Mariam Farag', content: 'Fit note — strong Laravel and HRIS module work (CV, screening).', createdAt: `${T}02T11:00:00.000Z`, updatedAt: `${T}02T11:00:00.000Z` }];
  const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Pre-Hire', 'Joined'].map((n, i) => ({ id: `st${i}`, name: n, stageType: n, sortOrder: i, required: true, isCurrent: n === stage, isCompleted: false, isNext: false, isAvailable: true, requirements: [] }));
  return {
    '/applications/a1/workspace': { application, stages, nextStage: null, nextStageRequirements: [], canAdvance: true, summary: { interviewCount: interviews.length, completedInterviewCount: 0, documentCount: 2 } },
    '/applications/a1/history': history,
    '/applications/a1/notes': notes,
    '/screening/application/a1': screening,
    '/interviews': interviews,
    '/interviews/iv1/scorecard': scorecards,
    '/offers': offer ? [offer] : [],
    '/offers/o1': offer,
    '/hiring': hiring,
    '/master-data/catalog/rejection-reasons': [{ id: 'rr1', name: 'Not enough experience', status: 'Active' }, { id: 'rr2', name: 'Failed technical interview', status: 'Active' }],
  };
}
