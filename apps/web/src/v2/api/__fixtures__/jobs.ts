/** Test/screenshot fixtures in the exact B3/B4/B1 shapes. Includes pay-looking fields to prove they never render. */
export const ME = 'u-mariam';
const counts = (a: number, s: number, i: number, o: number, p: number, j = 0, r = 0) => ({ Applied: a, Screening: s, Interview: i, Offer: o, 'Pre-Hire': p, Joined: j, Rejected: r, Withdrawn: 0 });
const META: Record<string, { dueDate: string; department: string; holdUntil?: string }> = {
  v1: { dueDate: '2026-10-19', department: 'IT' }, v2: { dueDate: '2026-10-30', department: 'Digital Health' }, v3: { dueDate: '2026-11-15', department: 'Nursing' },
  v4: { dueDate: '2026-11-05', department: 'Patient Experience' }, v5: { dueDate: '2026-12-01', department: 'HIM', holdUntil: '2026-11-01' }, v9: { dueDate: '2026-12-10', department: 'IT' },
};
const q = (id: string, title: string, site: string, status: string, joined: number, approved: number, c: Record<string, number>, owner = { id: ME, displayName: 'Mariam Farag' }) => ({
  id, code: `VAC-${id}`, title, branch: { id: `b-${site}`, name: site }, status, owner,
  dueDate: META[id]?.dueDate ?? null, department: META[id]?.department ?? null, holdUntil: META[id]?.holdUntil ?? null,
  headcount: { approved, joined, remaining: approved - joined }, pipelineCounts: c, needsActionCount: c.Applied, health: null,
  lastActivity: null, nextAction: null, budgetMax: 99000, salaryRange: '42000-50000',
});
export const workQueue = {
  data: [
    q('v1', 'HRIS Developer', 'Offshore Cairo', 'Partially Filled', 1, 3, counts(3, 3, 3, 1, 0, 1, 3)),
    q('v2', 'Laravel Backend Engineer', 'Offshore Cairo', 'Open', 0, 2, counts(4, 3, 2, 1, 1)),
    q('v3', 'Staff Nurse — ICU', 'SGH Dammam', 'Open', 2, 6, counts(5, 4, 3, 1, 1)),
    q('v4', 'Patient Relations Officer', 'SGH Jeddah', 'Open', 0, 3, counts(3, 2, 2, 1, 0)),
    q('v5', 'Medical Coder', 'SGH Riyadh', 'On Hold', 0, 1, counts(1, 0, 0, 0, 0)),
    { id: 'r1', redacted: true, title: 'Pharmacist', site: { id: 'b-j', name: 'SGH Jeddah' }, seats: { filled: 1, target: 4 } },
    { id: 'r2', redacted: true, title: 'Radiology Technician', site: { id: 'b-d', name: 'SGH Dammam' }, seats: { filled: 0, target: 4 } },
    q('v9', 'BI Data Analyst', 'SGH Riyadh', 'Open', 0, 1, counts(1, 0, 0, 0, 0), { id: 'u-other', displayName: 'Omar Said' }),
  ],
  total: 8, page: 1, pageSize: 100,
};
/** GET /vacancies/work-queue?mine=true (B3): only jobs I own. */
export const workQueueMine = { data: workQueue.data.filter((j) => !('redacted' in j) && j.owner?.id === ME), total: 5, page: 1, pageSize: 100 };
/** GET /master-data/catalog/hold-reasons | close-reasons (B3 seed; one deactivated value). */
export const holdReasons = ['Budget review', 'Hiring freeze', 'Role under review', 'Awaiting internal candidate', 'Other'].map((name, i) => ({ id: `hr${i}`, code: name.toUpperCase().replace(/\W+/g, '_'), name, status: 'Active' }))
  .concat([{ id: 'hr-x', code: 'OLD', name: 'Manager on leave', status: 'Inactive' }]);
export const closeReasons = ['Position no longer needed', 'Budget withdrawn', 'Filled internally', 'Other'].map((name, i) => ({ id: `cr${i}`, code: name.toUpperCase().replace(/\W+/g, '_'), name, status: 'Active' }));
const chip = (title: string, filled: number, target: number, dueDate: string) => ({ title, filled, target, label: `${filled} of ${target}`, dueDate });
export const vacancyList = [
  { id: 'v1', department: 'IT', targetChip: chip('HRIS Developer', 1, 3, '2026-10-19') },
  { id: 'v2', department: 'Digital Health', targetChip: chip('Laravel Backend Engineer', 0, 2, '2026-10-30') },
  { id: 'v3', department: 'Nursing', targetChip: chip('Staff Nurse — ICU', 2, 6, '2026-11-15') },
  { id: 'v4', department: 'Patient Experience', targetChip: chip('Patient Relations Officer', 0, 3, '2026-11-05') },
  { id: 'v5', department: 'HIM', targetChip: chip('Medical Coder', 0, 1, '2026-12-01') },
];
export const jobDetail = (status = 'Partially Filled') => ({
  id: 'v1', vacancyCode: 'VAC-2026-0041', status, title: null, position: { id: 'p1', title: 'HRIS Developer' }, branch: { id: 'b1', name: 'Offshore Cairo' }, department: 'IT',
  approvedHeadcount: 3, joinedHeadcount: 1, targetStartDate: '2026-11-01', vacancyRequestId: 'vr1',
  assignments: [{ userId: ME, assignmentKind: 'PRIMARY', isActive: true, user: { id: ME, displayName: 'Mariam Farag' } }],
  targetChip: chip('HRIS Developer', 1, 3, '2026-10-19'), budgetMin: 30000, budgetMax: 42000, budgetCurrency: 'EGP',
});
const GATE_KEYS = [['screen-note', 'GATE_SCREEN_NOTE_MISSING', 'screen note'], ['scorecard', 'GATE_SCORECARD_NOT_SUBMITTED', 'submitted scorecard'], ['offer-accepted', 'GATE_OFFER_NOT_ACCEPTED', 'accepted offer'], ['joining-checks', 'GATE_JOINING_CHECKS_INCOMPLETE', 'ID'], ['reject-reason', 'GATE_REJECT_REASON_REQUIRED', 'reason']] as const;
/** B5 gates[]: `met` lists the gate keys satisfied. */
export const gates = (...met: string[]) => GATE_KEYS.map(([gate, code, miss]) => ({ gate, code, met: met.includes(gate), missing: met.includes(gate) ? [] : gate === 'joining-checks' ? ['ID', 'CONTRACT', 'SCFHS_LICENCE'] : [miss] }));
const iv = (when: 'next' | 'last', startAt: string, endAt: string, name: string | null, url: string | null = null) => ({ interview: { when, startAt, endAt, room: { name, url } } });
const app = (id: string, first: string, last: string, stage: string, allowed: string[], extra: Record<string, unknown> = {}) => ({
  id, applicationCode: `APP-${id}`, vacancyId: 'v1', candidateId: `c-${id}`, stage, allowedTransitions: allowed, version: 3, source: 'LinkedIn',
  appliedAt: '2026-10-08T09:00:00Z', lastActivityAt: null, lastActivityLabel: null, nextFollowUpAt: null, followUpDate: null, gates: gates(), interview: null,
  candidate: { id: `c-${id}`, firstName: first, lastName: last, currentTitle: 'Analyst', email: `${first}@x.test`, phone: '+20 100', expectedSalary: 42000 }, ...extra,
});
export const applications = {
  data: [
    app('a1', 'Hany', 'Fawzy', 'Applied', ['Screening', 'Rejected', 'Withdrawn']),
    app('a2', 'Dina', 'Raafat', 'Applied', ['Screening', 'Rejected', 'Withdrawn'], { appliedAt: '2026-10-07T09:00:00Z', source: 'Referral' }),
    app('a3', 'Mostafa', 'Ali', 'Applied', ['Screening', 'Rejected', 'Withdrawn'], { appliedAt: '2026-10-07T09:00:00Z', source: 'Careers site' }),
    app('a4', 'Nourhan', 'Sami', 'Screening', ['Applied', 'Interview', 'Rejected', 'Withdrawn'], { lastActivityLabel: 'Phone screening booked', lastActivityAt: '2026-10-10T08:30:00Z', gates: gates('screen-note') }),
    app('a5', 'Khaled', 'Mahmoud', 'Screening', ['Applied', 'Interview', 'Rejected', 'Withdrawn'], { lastActivityLabel: 'Screening booked', lastActivityAt: '2026-10-12T08:30:00Z' }),
    app('a6', 'Salma', 'Adel', 'Screening', ['Applied', 'Interview', 'Rejected', 'Withdrawn'], { lastActivityLabel: 'Awaiting call-back', nextFollowUpAt: '2026-10-07T07:00:00Z', followUpDate: '2026-10-07' }),
    app('a7', 'Ahmed', 'Embaby', 'Interview', ['Screening', 'Offer', 'Rejected', 'Withdrawn'], { lastActivityLabel: 'Interviewed', lastActivityAt: '2026-10-06T10:00:00Z', gates: gates('screen-note'), ...iv('last', '2026-10-06T07:00:00Z', '2026-10-06T08:00:00Z', null, 'https://teams.microsoft.com/l/x') }),
    app('a8', 'Tarek', 'Lotfy', 'Interview', ['Screening', 'Offer', 'Rejected', 'Withdrawn'], { lastActivityLabel: 'Interview booked', lastActivityAt: '2026-10-12T07:00:00Z', gates: gates('screen-note'), ...iv('next', '2026-10-12T07:00:00Z', '2026-10-12T08:00:00Z', 'Room 3B, IT wing') }),
    app('a9', 'Mai', 'Ezzat', 'Interview', ['Screening', 'Offer', 'Rejected', 'Withdrawn'], { lastActivityLabel: 'Interview booked', lastActivityAt: '2026-10-13T10:00:00Z', gates: gates('screen-note', 'scorecard'), ...iv('next', '2026-10-13T10:00:00Z', '2026-10-13T11:00:00Z', null, 'https://teams.microsoft.com/l/y') }),
    app('a10', 'Lina', 'Hassan', 'Offer', ['Interview', 'Pre-Hire', 'Rejected', 'Withdrawn'], { lastActivityLabel: 'Offer v1 submitted', lastActivityAt: '2026-10-08T10:00:00Z', gates: gates('screen-note', 'scorecard') }),
    app('a11', 'Omar', 'Nabil', 'Rejected', []),
    app('a12', 'Rana', 'Fouad', 'Rejected', []),
    app('a13', 'Youssef', 'Gamal', 'Rejected', []),
    app('a14', 'Hoda', 'Saleh', 'Joined', []),
  ],
  total: 14, page: 1, pageSize: 100,
};
export const statusHistory = [
  { id: 'h1', fromStatus: null, toStatus: 'Open', reason: 'Activated from REQ-2026-0019', changedById: 'u-karim', createdAt: '2026-09-20T08:00:00Z' },
  { id: 'h2', fromStatus: 'Open', toStatus: 'Partially Filled', reason: 'Seat filled (Joined)', changedById: ME, createdAt: '2026-10-02T08:00:00Z', holdUntil: null },
];
export const redactedJob = { id: 'r1', redacted: true, title: 'Pharmacist', site: { id: 'b-j', name: 'SGH Jeddah' }, seats: { filled: 1, target: 4 } };
export const parsed = { firstName: 'Rania', lastName: 'Kamel', email: 'Rania.Kamel@Gmail.com', phone: '+20 100 555 0192', title: 'HR Systems Analyst', currentCompany: 'Andalusia Group', experienceYears: 6, rawText: 'Rania Kamel HR Systems Analyst…', skills: ['HRIS'] };
export const parsedDup = { firstName: 'Nourhan', lastName: 'Sami', email: 'nourhan.sami@gmail.com', phone: '01005550111', rawText: 'Nourhan Sami…' };
export const noDup = { normalized: { email: 'rania.kamel@gmail.com', phone: '201005550192' }, isDuplicate: false, matches: [] };
export const dup = { normalized: { email: 'nourhan.sami@gmail.com', phone: '201005550111' }, isDuplicate: true, matches: [{ candidateId: 'c-a4', candidateCode: 'CAN-2026-0007', name: 'Nourhan Sami', status: 'Active', matchedBy: ['email'] }] };
