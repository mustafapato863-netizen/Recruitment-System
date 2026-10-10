/** Exact B3/B4 VacancyRequest shapes (feat/b3-req-job-lifecycle @2e2fc7d + feat/b4-my-work targetChip). Includes budget a bad screen might show. */
export const ME = 'u-karim';
const chip = (title: string, filled: number, target: number, dueDate: string | null) => ({ title, filled, target, label: `${filled} of ${target}`, dueDate });
const req = (id: string, code: string, positionId: string, title: string, branchId: string, status: string, seats: number, due: string | null, extra: Record<string, unknown> = {}) => ({
  id, organizationId: 'o', branchId, positionId, requesterId: ME, requestCode: code, status, statusLabel: status === 'Converted to Vacancy' ? 'Active' : status,
  targetChip: chip(code, 0, seats, due), requestedHeadcount: seats, employmentType: 'Full-time', reason: null,
  budgetStatus: 'Approved', budgetMin: 30000, budgetMax: 42000, budgetCurrency: 'EGP', criticality: null, targetStartDate: null,
  targetFillDate: due, dueDate: due, recruitmentTiming: 'After Approval', plannedOpenDate: null, justification: null, jobSummary: null,
  description: null, responsibilities: null, qualifications: null, benefits: null, submittedAt: null, approvalRevision: 1,
  gradeId: null, assignedEmployeeId: null, activatedAt: null, cancelledAt: null, cancelReason: null, approvals: [],
  createdAt: '2026-09-20T09:00:00Z', updatedAt: '2026-10-01T09:00:00Z', position: { title }, ...extra,
});
export const requisitions = [
  req('r412', 'REQ-IT-0412', 'p-hris', 'HRIS Developer', 'b-cairo', 'Converted to Vacancy', 3, '2026-10-19', { assignedEmployeeId: 'u-mariam', activatedAt: '2026-09-20T09:00:00Z', targetChip: chip('REQ-IT-0412', 1, 3, '2026-10-19') }),
  req('r415', 'REQ-IT-0415', 'p-laravel', 'Laravel Backend Engineer', 'b-cairo', 'Converted to Vacancy', 2, '2026-10-30', { assignedEmployeeId: 'u-mariam', activatedAt: '2026-09-28T09:00:00Z' }),
  req('r420', 'REQ-IT-0420', 'p-bi', 'BI Data Analyst', 'b-riyadh', 'Approved', 1, '2026-10-30', { assignedEmployeeId: 'u-youssef' }),
  req('r421', 'REQ-IT-0421', 'p-payroll', 'Payroll Systems Analyst', 'b-riyadh', 'Draft', 1, null, { assignedEmployeeId: 'u-youssef', gradeId: 'g7', justification: 'Backfill for Payroll HRIS support. Arabic and English. Oracle HCM payroll a must.', targetChip: chip('REQ-IT-0421', 0, 1, null) }),
  req('r398', 'REQ-IT-0398', 'p-int', 'Integration Engineer', 'b-cairo', 'Cancelled', 1, null, { cancelReason: 'budget moved to FY27', cancelledAt: '2026-09-30T09:00:00Z' }),
  req('r-other', 'REQ-NUR-0007', 'p-nurse', 'Staff Nurse NICU', 'b-riyadh', 'Draft', 4, '2026-11-15', { requesterId: 'u-other', assignedEmployeeId: 'u-zz' }),
];
export const context = {
  organization: { id: 'o', name: 'SGH' }, branch: null, position: null, requester: { id: ME, displayName: 'Karim Hassan' },
  branches: [{ id: 'b-cairo', name: 'Offshore Cairo' }, { id: 'b-riyadh', name: 'SGH Riyadh' }],
  positions: [{ id: 'p-bi', title: 'BI Data Analyst' }, { id: 'p-hris', title: 'HRIS Developer' }, { id: 'p-int', title: 'Integration Engineer' }, { id: 'p-laravel', title: 'Laravel Backend Engineer' }, { id: 'p-payroll', title: 'Payroll Systems Analyst' }],
};
export const assignable = [
  { id: 'u-mariam', displayName: 'Mariam Farag', status: 'Active', roles: [{ code: 'ROLE_001', name: 'Recruiter-offshore' }] },
  { id: 'u-youssef', displayName: 'Youssef Ibrahim', status: 'Active', roles: [{ code: 'ROLE_002', name: 'Recruiter-onshore' }] },
  { id: 'u-gone', displayName: 'Old Recruiter', status: 'Inactive', roles: [] },
];
export const grades = [
  { id: 'g6', code: 'G6', name: 'Grade 6', status: 'Active' }, { id: 'g7', code: 'G7', name: 'Grade 7', status: 'Active' }, { id: 'g9', code: 'G9', name: 'Grade 9 (old)', status: 'Inactive' },
];
