/**
 * Human-readable permission labels aligned with backend permission codes.
 * Keep codes identical to API / DB permission.code values.
 */
export const PERMISSION_LABELS: Record<string, string> = {
  VACANCY_VIEW: 'View Vacancies',
  VACANCY_MANAGE: 'Manage Vacancies',
  VACANCY_ASSIGN: 'Assign Vacancy Recruiter',
  VACANCY_REASSIGN: 'Reassign Vacancy Recruiter',
  VACANCY_REQUEST_VIEW: 'View Vacancy Requests',
  VACANCY_REQUEST_CREATE: 'Create Vacancy Requests',
  VACANCY_REQUEST_APPROVE: 'Approve Vacancy Requests',
  CANDIDATE_VIEW: 'View Candidates',
  CANDIDATE_CREATE: 'Create Candidates',
  CANDIDATE_EDIT: 'Edit Candidates',
  APPLICATION_VIEW: 'View Applications',
  APPLICATION_MOVE_STAGE: 'Move Application Stage',
  APPROVE_OFFERS: 'Approve Offers',
  FINAL_HIRING_APPROVAL: 'Final Hiring Approval',
  VIEW_CURRENT_SALARY: 'View Current Salary',
  USERS_VIEW: 'View Users',
  USERS_MANAGE: 'Manage Users',
  ROLES_MANAGE: 'Manage Roles',
  MASTER_DATA_VIEW: 'View Master Data',
  MASTER_DATA_MANAGE: 'Manage Master Data',
  AUDIT_VIEW: 'View Audit Log',
  OVERRIDE_WORKFLOW: 'Override Workflow',
  NOTIFICATION_VIEW: 'View Notifications',
  TASK_VIEW: 'View Tasks',
};

export function getPermissionLabel(code: string): string {
  return PERMISSION_LABELS[code] ?? code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatPermissionRequirement(options: {
  requiredPermission?: string | null;
  requiredAnyPermissions?: readonly string[] | null;
}): string {
  if (options.requiredPermission) {
    const code = options.requiredPermission;
    return `${getPermissionLabel(code)} (${code})`;
  }
  const any = options.requiredAnyPermissions?.filter(Boolean) ?? [];
  const [first] = any;
  if (any.length === 1 && first) {
    return `${getPermissionLabel(first)} (${first})`;
  }
  if (any.length > 1) {
    return any.map((code) => `${getPermissionLabel(code)} (${code})`).join(' or ');
  }
  return 'an elevated permission';
}

/**
 * Canonical navigation catalogue — shared by API and web so route guards,
 * sidebar items, and admin navigation settings cannot drift.
 */
export const NAVIGATION_CATALOG = [
  { key: 'dashboard', route: '/', label: 'Command Center', icon: 'dashboard', group: 'Workspace', sortOrder: 10, visible: true, requiredAnyPermissions: ['VACANCY_REQUEST_APPROVE', 'USERS_MANAGE', 'VACANCY_MANAGE', 'MASTER_DATA_VIEW'] },
  { key: 'vacancy-requests', route: '/vacancy-requests', label: 'Requisitions', icon: 'file-text', group: 'Workspace', sortOrder: 20, visible: true, requiredPermission: 'VACANCY_REQUEST_VIEW' },
  { key: 'vacancies', route: '/vacancies', label: 'Job Positions', icon: 'briefcase', group: 'Workspace', sortOrder: 30, visible: true, requiredPermission: 'VACANCY_VIEW' },
  { key: 'applications', route: '/applications', label: 'Applications', icon: 'users', group: 'Recruitment', sortOrder: 40, visible: true, requiredPermission: 'APPLICATION_VIEW' },
  { key: 'approval-inbox', route: '/approval-inbox', label: 'Approval Inboxes', icon: 'check-circle', group: 'Recruitment', sortOrder: 50, visible: true, requiredAnyPermissions: ['VACANCY_REQUEST_APPROVE', 'APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL'] },
  { key: 'interviews', route: '/interviews', label: 'Interviews', icon: 'calendar', group: 'Recruitment', sortOrder: 60, visible: true, requiredPermission: 'VACANCY_VIEW' },
  { key: 'offers', route: '/offers', label: 'Offers', icon: 'offer', group: 'Recruitment', sortOrder: 70, visible: true, requiredPermission: 'APPLICATION_VIEW' },
  { key: 'candidates', route: '/candidates', label: 'Candidates DB', icon: 'database', group: 'Sourcing & Talent', sortOrder: 80, visible: true, requiredPermission: 'CANDIDATE_VIEW' },
  { key: 'cv-bank', route: '/cv-bank', label: 'CV Bank', icon: 'file-text', group: 'Sourcing & Talent', sortOrder: 85, visible: true, requiredPermission: 'CANDIDATE_VIEW' },
  { key: 'cv-intake', route: '/cv-intake', label: 'CV Intake', icon: 'upload', group: 'Sourcing & Talent', sortOrder: 90, visible: true, requiredPermission: 'CANDIDATE_CREATE' },
  { key: 'sourcing-match', route: '/sourcing-match', label: 'Smart Sourcing & Match', icon: 'sparkles', group: 'Sourcing & Talent', sortOrder: 100, visible: true, requiredPermission: 'CANDIDATE_VIEW' },
  { key: 'joinings', route: '/joinings', label: 'Hires & Joining', icon: 'user-check', group: 'Compliance & Hires', sortOrder: 110, visible: true, requiredPermission: 'APPLICATION_VIEW' },
  { key: 'licenses', route: '/licenses', label: 'Medical Licenses', icon: 'shield-check', group: 'Compliance & Hires', sortOrder: 120, visible: true, requiredPermission: 'APPLICATION_VIEW' },
  { key: 'reports', route: '/reports', label: 'Reports', icon: 'report', group: 'Governance', sortOrder: 130, visible: true, requiredPermission: 'APPLICATION_VIEW' },
  { key: 'users', route: '/users', label: 'Users & Roles', icon: 'users', group: 'Governance', sortOrder: 140, visible: true, requiredPermission: 'USERS_VIEW' },
  { key: 'reporting-tree', route: '/reporting-tree', label: 'Reporting Tree', icon: 'pipeline', group: 'Governance', sortOrder: 145, visible: true, requiredPermission: 'USERS_VIEW' },
  { key: 'master-data', route: '/master-data', label: 'Master Data', icon: 'database', group: 'Governance', sortOrder: 150, visible: true, requiredPermission: 'MASTER_DATA_VIEW' },
  { key: 'audit-log', route: '/audit-log', label: 'Audit Log', icon: 'history', group: 'Governance', sortOrder: 160, visible: true, requiredPermission: 'AUDIT_VIEW' },
  { key: 'email-templates', route: '/email-templates', label: 'Email Templates', icon: 'mail', group: 'Governance', sortOrder: 170, visible: true, requiredPermission: 'MASTER_DATA_MANAGE' },
  { key: 'whatsapp-templates', route: '/whatsapp-templates', label: 'WhatsApp Templates', icon: 'chat', group: 'Governance', sortOrder: 175, visible: true, requiredPermission: 'MASTER_DATA_MANAGE' },
  { key: 'integrations', route: '/integrations', label: 'Integrations', icon: 'integrations', group: 'Governance', sortOrder: 180, visible: true, requiredPermission: 'MASTER_DATA_VIEW' },
  { key: 'settings', route: '/settings', label: 'Settings', icon: 'settings', group: 'Governance', sortOrder: 190, visible: true, requiredAnyPermissions: ['USERS_VIEW', 'MASTER_DATA_VIEW', 'OVERRIDE_WORKFLOW', 'AUDIT_VIEW'] },
  { key: 'notifications', route: '/notifications', label: 'Notifications', icon: 'bell', group: 'Governance', sortOrder: 200, visible: true, requiredPermission: 'NOTIFICATION_VIEW' },
  { key: 'tasks', route: '/tasks', label: 'Tasks', icon: 'tasks', group: 'Governance', sortOrder: 210, visible: true, requiredPermission: 'TASK_VIEW' },
];

export function getNavigationCatalogItem(key: string) {
  return NAVIGATION_CATALOG.find((item) => item.key === key);
}

