/** Exact GlobalSearchResponse / NotificationRecord shapes from origin (search.service.ts, notifications.service.ts). */
export const search = {
  query: 'Ahmed', total: 6,
  groups: [
    { entityType: 'candidate', label: 'Candidates', items: [
      { entityType: 'candidate', entityId: 'c-a7', title: 'Ahmed Embaby', subtitle: 'Laravel Developer · CAN-2026-0002 · ahmed.embaby@mail.test', status: 'Active' },
      { entityType: 'candidate', entityId: 'c-x', title: 'Ahmed Fathy', subtitle: 'Staff Nurse · CAN-2026-0090 · afathy@mail.test', status: 'Active' },
    ] },
    { entityType: 'vacancy', label: 'Vacancies', items: [
      { entityType: 'vacancy', entityId: 'v1', title: 'HRIS Developer', subtitle: 'VAC-2026-0041 · Offshore Cairo', status: 'Open' },
      { entityType: 'vacancy', entityId: 'r1', title: 'Pharmacist', subtitle: 'VAC-2026-0050 · Offshore Cairo', status: 'Open' },
      { entityType: 'vacancy', entityId: 'r9', title: 'Lab Technician', subtitle: 'SGH Riyadh · 1/2 seats', redacted: true, status: 'Open', vacancyCode: 'VAC-2026-0099' },
      { entityType: 'vacancy', entityId: 'v-nicu', title: 'Staff Nurse NICU', subtitle: 'VAC-2026-0077 · Riyadh', status: 'Open' },
    ] },
    { entityType: 'application', label: 'Applications', items: [
      { entityType: 'application', entityId: 'a7', title: 'Ahmed Embaby', subtitle: 'HRIS Developer · APP-2026-0101', status: 'Interview' },
      { entityType: 'application', entityId: 'a-other', title: 'Ahmed Fathy', subtitle: 'Staff Nurse NICU · APP-2026-0200', status: 'Offer' },
    ] },
    { entityType: 'task', label: 'Tasks', items: [{ entityType: 'task', entityId: 't1', title: 'Call Ahmed Embaby', subtitle: 'High · Due 2026-10-12T09:00:00.000Z', status: 'Open' }] },
    { entityType: 'offer', label: 'Offers', items: [{ entityType: 'offer', entityId: 'o1', title: 'Ahmed Embaby offer', subtitle: 'EGP 42,000', status: 'Draft' }] },
  ],
};
export const myApps = { data: [{ id: 'a7', candidateId: 'c-a7', stage: 'Interview', positionTitle: 'HRIS Developer', primaryRecruiterName: 'Mariam Farag' }] };
const iso = (minAgo: number) => new Date(Date.now() - minAgo * 60000).toISOString();
export const notifications = () => ({ total: 4, page: 1, pageSize: 10, data: [
  { id: 'n1', organizationId: 'o', recipientUserId: 'u', type: 'OFFER_COMMENT', title: "Karim Hassan commented on Lina Hassan's offer", message: '“Confirm the 1 Nov start date before I decide.” · HRIS Developer', entityType: 'Application', entityId: 'a10', readAt: null, createdAt: iso(12) },
  { id: 'n2', organizationId: 'o', recipientUserId: 'u', type: 'SCORECARD_DUE', title: 'Scorecard for Ahmed Embaby was due 7 Oct', message: 'Interview held 6 Oct · HRIS Developer', entityType: 'Interview', entityId: 'i1', applicationId: 'a7', readAt: null, createdAt: iso(60) },
  { id: 'n3', organizationId: 'o', recipientUserId: 'u', type: 'FOLLOW_UP', title: 'Follow-up date passed — Salma Adel', message: 'HRIS Developer · follow-up date was 7 Oct', entityType: 'Vacancy', entityId: 'v1', readAt: '2026-10-09T08:00:00Z', createdAt: iso(300) },
  { id: 'n4', organizationId: 'o', recipientUserId: 'u', type: 'OFFER_APPROVED', title: 'Offer approved', message: 'Package EGP 42,000 monthly', entityType: 'Offer', entityId: 'o1', applicationId: 'a10', readAt: '2026-10-09T08:00:00Z', createdAt: iso(2000) },
] });
