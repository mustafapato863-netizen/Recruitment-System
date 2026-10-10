/** B5 application list items + B7 offers for M2 Team work. Dates are relative to today (Cairo) so the chips stay stable. */
import { cairoToday } from '../jobs';

export const day = (n: number) => { const d = new Date(`${cairoToday()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const at = (n: number, hh = '11:00') => `${day(n)}T${hh}:00.000Z`;
const gate = (g: string, met: boolean) => ({ gate: g, code: `GATE_${g.toUpperCase().replace(/-/g, '_')}`, met, missing: met ? [] : ['x'] });
const app = (id: string, owner: string, first: string, last: string, title: string, site: string, stage: string, extra: Record<string, unknown> = {}) => ({
  id, organizationId: 'o', applicationCode: `APP-${id.toUpperCase()}`, vacancyId: `v-${title.toLowerCase().replace(/\W+/g, '-')}`, candidateId: `c-${id}`,
  stage, allowedTransitions: [], version: 1, source: 'Careers site', primaryRecruiterId: owner, followUpDate: null,
  candidate: { id: `c-${id}`, firstName: first, lastName: last, email: 'x@y.z', currentTitle: null, expectedSalary: 40000 },
  vacancyCode: 'JOB-1', positionTitle: title, vacancyLocation: site, vacancyBranchName: site, appliedAt: at(-20), createdAt: at(-20), updatedAt: at(-1), gates: [], interview: null, ...extra,
});
export const assignable = [
  { id: 'u-mariam', displayName: 'Mariam Farag', status: 'Active', roles: [{ code: 'ROLE_001', name: 'Recruiter-offshore' }] },
  { id: 'u-youssef', displayName: 'Youssef Ibrahim', status: 'Active', roles: [{ code: 'ROLE_002', name: 'Recruiter-onshore' }] },
  { id: 'u-noura', displayName: 'Noura Al-Dosari', status: 'Active', roles: [{ code: 'ROLE_003', name: 'Recruiter-clinical' }] },
];
export const apps: Record<string, unknown[]> = {
  'u-mariam': [
    app('a1', 'u-mariam', 'Ahmed', 'Embaby', 'HRIS Developer', 'Offshore Cairo', 'Interview', { gates: [gate('scorecard', false)], interview: { when: 'last', startAt: at(-4, '07:00'), endAt: at(-4, '08:00'), room: { name: null, url: 'https://teams.microsoft.com/x' } } }),
    app('a2', 'u-mariam', 'Nourhan', 'Sami', 'HRIS Developer', 'Offshore Cairo', 'Screening', { followUpDate: day(0) }),
    app('a3', 'u-mariam', 'Lina', 'Hassan', 'HRIS Developer', 'Offshore Cairo', 'Offer', { followUpDate: day(-1) }),
    app('a9', 'u-mariam', 'Old', 'Joiner', 'HRIS Developer', 'Offshore Cairo', 'Joined'),
  ],
  'u-youssef': [
    app('y1', 'u-youssef', 'Rana', 'Adel', 'BI Data Analyst', 'SGH Riyadh', 'Interview', { interview: { when: 'next', startAt: at(3, '07:00'), endAt: at(3, '08:00'), room: { name: 'Room 2', url: null } } }),
    app('y2', 'u-youssef', 'Hossam', 'Nabil', 'Pharmacist', 'SGH Jeddah', 'Offer'),
  ],
  'u-noura': [
    app('n1', 'u-noura', 'Fahad', 'Al-Qahtani', 'Radiology Technician', 'SGH Riyadh', 'Screening', { followUpDate: day(-4) }),
    app('n2', 'u-noura', 'Sara', 'Al-Otaibi', 'Radiology Technician', 'SGH Riyadh', 'Interview', { followUpDate: day(-1) }),
    app('n3', 'u-noura', 'Majed', 'Saleh', 'Radiology Technician', 'SGH Riyadh', 'Applied', { followUpDate: day(2) }),
  ],
};
const version = (id: string, n: number, status: string, createdAt: string) => ({ id, offerId: 'o', versionNumber: n, status, approvalStatus: 'Pending', monthlyPackage: 62000, annualFixed: 744000, components: [{ id: 'c', type: 'Salary', name: 'Basic', amount: 62000, currency: 'EGP' }], approvals: [], createdAt });
export const pendingOffers = [
  { id: 'o1', organizationId: 'o', applicationId: 'a3', candidateName: 'Lina Hassan', positionTitle: 'HRIS Developer', grade: { id: 'g8', name: 'Grade 8' }, location: 'Offshore Cairo', offerCode: 'OFF-1', status: 'Pending Approval', currentVersionId: 'ov1', versions: [version('ov1', 1, 'Pending Approval', at(-1, '12:20'))], createdAt: at(-2), updatedAt: at(-1) },
  { id: 'o-x', organizationId: 'o', applicationId: 'not-my-team', candidateName: 'Elsewhere', positionTitle: 'Nurse', status: 'Pending Approval', currentVersionId: 'ovx', versions: [version('ovx', 1, 'Pending Approval', at(-1))], offerCode: 'OFF-2', createdAt: at(-2), updatedAt: at(-1) },
];
export const teamPaths = (): Record<string, unknown> => ({
  '/users/assignable': assignable,
  ...Object.fromEntries(Object.entries(apps).map(([id, rows]) => [`/applications?primaryRecruiterId=${id}&pageSize=100`, { data: rows, total: rows.length }])),
  '/offers?status=Pending+Approval&pageSize=100': pendingOffers,
});
