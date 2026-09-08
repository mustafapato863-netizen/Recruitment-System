import type { NavigationItemRecord } from '@recruitflow/contracts';

/**
 * The route catalogue is code-owned; labels and visibility are organization
 * settings persisted by the administrator. Access permissions remain enforced
 * independently by the route guards and API decorators.
 */
export const NAVIGATION_CATALOG: NavigationItemRecord[] = [
  { key: 'dashboard', route: '/', label: 'Command Center', icon: 'dashboard', group: 'Workspace', sortOrder: 10, visible: true, requiredAnyPermissions: ['VACANCY_REQUEST_APPROVE', 'USERS_MANAGE', 'VACANCY_MANAGE', 'MASTER_DATA_VIEW'] },
  { key: 'vacancy-requests', route: '/vacancy-requests', label: 'Requisitions', icon: 'file-text', group: 'Workspace', sortOrder: 20, visible: true, requiredPermission: 'VACANCY_REQUEST_VIEW' },
  { key: 'vacancies', route: '/vacancies', label: 'Job Positions', icon: 'briefcase', group: 'Workspace', sortOrder: 30, visible: true, requiredPermission: 'VACANCY_VIEW' },
  { key: 'applications', route: '/applications', label: 'Applications', icon: 'users', group: 'Recruitment', sortOrder: 40, visible: true, requiredPermission: 'APPLICATION_VIEW' },
  { key: 'approval-inbox', route: '/approval-inbox', label: 'Approval Inboxes', icon: 'check-circle', group: 'Recruitment', sortOrder: 50, visible: true, requiredAnyPermissions: ['VACANCY_REQUEST_APPROVE', 'APPROVE_OFFERS', 'FINAL_HIRING_APPROVAL'] },
  { key: 'interviews', route: '/interviews', label: 'Interviews', icon: 'calendar', group: 'Recruitment', sortOrder: 60, visible: true, requiredPermission: 'VACANCY_VIEW' },
  { key: 'offers', route: '/offers', label: 'Offers', icon: 'offer', group: 'Recruitment', sortOrder: 70, visible: true, requiredPermission: 'APPLICATION_VIEW' },
  { key: 'candidates', route: '/candidates', label: 'Candidates DB', icon: 'database', group: 'Sourcing & Talent', sortOrder: 80, visible: true, requiredPermission: 'CANDIDATE_VIEW' },
  { key: 'cv-intake', route: '/cv-intake', label: 'CV Intake', icon: 'upload', group: 'Sourcing & Talent', sortOrder: 90, visible: true, requiredPermission: 'CANDIDATE_CREATE' },
  { key: 'sourcing-match', route: '/sourcing-match', label: 'Smart Sourcing & Match', icon: 'sparkles', group: 'Sourcing & Talent', sortOrder: 100, visible: true, requiredPermission: 'CANDIDATE_VIEW' },
  { key: 'joinings', route: '/joinings', label: 'Hires & Joining', icon: 'user-check', group: 'Compliance & Hires', sortOrder: 110, visible: true, requiredPermission: 'APPLICATION_VIEW' },
  { key: 'licenses', route: '/licenses', label: 'Medical Licenses', icon: 'shield-check', group: 'Compliance & Hires', sortOrder: 120, visible: true, requiredPermission: 'APPLICATION_VIEW' },
  { key: 'reports', route: '/reports', label: 'Reports', icon: 'report', group: 'Governance', sortOrder: 130, visible: true, requiredPermission: 'APPLICATION_VIEW' },
  { key: 'users', route: '/users', label: 'Users & Roles', icon: 'users', group: 'Governance', sortOrder: 140, visible: true, requiredPermission: 'USERS_VIEW' },
  { key: 'master-data', route: '/master-data', label: 'Master Data', icon: 'database', group: 'Governance', sortOrder: 150, visible: true, requiredPermission: 'MASTER_DATA_VIEW' },
  { key: 'audit-log', route: '/audit-log', label: 'Audit Log', icon: 'history', group: 'Governance', sortOrder: 160, visible: true, requiredPermission: 'AUDIT_VIEW' },
  { key: 'email-templates', route: '/email-templates', label: 'Email Templates', icon: 'mail', group: 'Governance', sortOrder: 170, visible: true, requiredPermission: 'MASTER_DATA_VIEW' },
  { key: 'integrations', route: '/integrations', label: 'Integrations', icon: 'integrations', group: 'Governance', sortOrder: 180, visible: true, requiredPermission: 'MASTER_DATA_VIEW' },
  { key: 'settings', route: '/settings', label: 'Settings', icon: 'settings', group: 'Governance', sortOrder: 190, visible: true, requiredAnyPermissions: ['USERS_VIEW', 'MASTER_DATA_VIEW', 'OVERRIDE_WORKFLOW', 'AUDIT_VIEW'] },
  { key: 'notifications', route: '/notifications', label: 'Notifications', icon: 'bell', group: 'Governance', sortOrder: 200, visible: true, requiredPermission: 'NOTIFICATION_VIEW' },
  { key: 'tasks', route: '/tasks', label: 'Tasks', icon: 'tasks', group: 'Governance', sortOrder: 210, visible: true, requiredPermission: 'TASK_VIEW' },
];
