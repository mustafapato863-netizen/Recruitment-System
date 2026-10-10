/** A1/A2 fixtures (Figma A02–A04 names). Exact contracts UserRecord / RoleRecord shapes. */
const R = (id: string, code: string, name: string) => ({ id, code, name });
const u = (id: string, displayName: string, roles: Array<{ id: string; code: string; name: string }>, managerId: string | null, status = 'Active', jobTitle: string | null = null) => ({
  id, email: `${displayName.toLowerCase().replace(/[^a-z]+/g, '.').replace(/\.$/, '')}@recruitflow.app`, displayName, jobTitle, status, organizationId: 'org', managerId, roles, lastLoginAt: '2026-10-09T07:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
});
const ADMIN = R('r-admin', 'ADMINISTRATOR', 'Administrator');
const HM = R('r-hm', 'HIRING_MANAGER', 'Hiring Manager');
const REC = R('r-rec', 'RECRUITER', 'Recruiter');
export const users = [
  u('u-omar', 'Omar Khalil', [ADMIN], null, 'Active', 'HR Systems'),
  u('u-karim', 'Karim Hassan', [HM], 'u-hala', 'Active', 'IT'),
  u('u-hala', 'Hala Mostafa', [HM], null, 'Active', 'Talent'),
  u('u-mariam', 'Mariam Farag', [REC], 'u-karim', 'Active', 'Recruiter-offshore'),
  u('u-youssef', 'Youssef Ibrahim', [REC], 'u-karim', 'Active', 'Recruiter-onshore'),
  u('u-noura', 'Noura Al-Dosari', [REC], 'u-karim', 'Active', 'Recruiter-clinical'),
  u('u-ahmed', 'Ahmed Fathy', [REC], 'u-hala', 'Active', 'Recruiter-clinical'),
  u('u-rasha', 'Rasha Nabil', [REC], 'u-hala', 'Invited', 'Recruiter-onshore'),
  u('u-old', 'Old Leaver', [REC], 'u-hala', 'Inactive'),
];
const P = (id: string, code: string) => ({ id, code, name: code, description: null });
export const perms = [P('p-users', 'USERS_VIEW'), P('p-app', 'APPLICATION_VIEW'), P('p-int', 'INTERVIEW_PARTICIPATE'), P('p-lic', 'LICENSE_CHECK')];
export const roles = [
  { ...ADMIN, status: 'Active', permissions: [perms[0]] },
  { ...HM, status: 'Active', permissions: [perms[1], perms[2]] },
  { ...REC, status: 'Active', permissions: [perms[1]] },
  { ...R('r-int', 'INTERVIEWER', 'Interviewer'), status: 'Active', permissions: [perms[1]] },
  { ...R('r-lic', 'LICENSE_SPECIALIST', 'License Specialist'), status: 'Active', permissions: [] },
  { ...R('r-x', 'CUSTOM_OPS', 'Ops custom'), status: 'Active', permissions: [] },
];
