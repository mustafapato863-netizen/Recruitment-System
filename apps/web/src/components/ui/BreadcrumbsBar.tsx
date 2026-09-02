import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../Icon';

const PATH_NAME_MAP: Record<string, string> = {
  '': 'Home',
  vacancies: 'Job Positions',
  'vacancy-requests': 'Vacancy Requests',
  applications: 'Applications Kanban',
  interviews: 'Interviews & Scheduling',
  calendar: 'Calendar',
  offers: 'Offers & Packages',
  candidates: 'Candidates Directory',
  'cv-intake': 'Smart CV Intake',
  'talent-pool': 'Talent Pools',
  'talent-pools': 'Talent Pools',
  reports: 'Reports & Analytics',
  settings: 'Settings Hub',
  targets: 'Position Targets',
  'master-data': 'Master Data',
  'pipeline-settings': 'Pipeline Builder',
  users: 'Users & Roles',
  integrations: 'Integrations & Webhooks',
  'audit-log': 'Security & Audit Log',
  tasks: 'Tasks & Reminders',
  notifications: 'Notifications',
  profile: 'My Profile',
  new: 'Create New',
  'approval-inbox': 'Approvals Inbox',
  hires: 'Pre-Hire & Hires',
  joinings: 'Joinings Management',
  licenses: 'Licenses & Credentials',
  'candidate-documents': 'Candidate Documents',
  compare: 'Candidate Comparison',
};

export function BreadcrumbsBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const pathnames = useMemo(() => {
    return location.pathname.split('/').filter(Boolean);
  }, [location.pathname]);

  // Don't render empty breadcrumb bar on root dashboard if user doesn't need navigation
  if (location.pathname === '/') {
    return null;
  }

  const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  const isCode = (str: string) => /^(APP|OFF|VAC|INT|REQ|CMD)-[0-9A-Za-z-]+$/i.test(str);

  return (
    <nav
      aria-label="Breadcrumb"
      className="breadcrumbs-bar bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 lg:px-7 py-2 flex items-center justify-between gap-3 text-xs z-20 shadow-2xs"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto rf-scrollbar">
        {/* MUI-Style Back Button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 dark:hover:text-blue-400 font-bold transition shadow-2xs cursor-pointer shrink-0 group border border-slate-200/60 dark:border-slate-700/60"
          title="Go back to previous page"
        >
          <Icon name="arrow-left" size={13} className="text-slate-500 group-hover:-translate-x-0.5 transition" />
          <span>Back</span>
        </button>

        <span className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" aria-hidden="true" />

        {/* Home Root */}
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition shrink-0"
        >
          <Icon name="dashboard" size={13} className="text-slate-400" />
          <span className="hidden sm:inline">Home</span>
        </Link>

        {/* Trail Crumbs */}
        {pathnames.map((segment, index) => {
          const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;

          let friendlyLabel = PATH_NAME_MAP[segment.toLowerCase()];
          if (!friendlyLabel) {
            if (isUUID(segment)) {
              friendlyLabel = `Item #${segment.substring(0, 6)}`;
            } else if (isCode(segment)) {
              friendlyLabel = segment;
            } else {
              friendlyLabel = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
            }
          }

          return (
            <div key={routeTo} className="inline-flex items-center gap-2 shrink-0">
              <span className="text-slate-300 dark:text-slate-600 select-none">/</span>
              {isLast ? (
                <span
                  aria-current="page"
                  className="font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50"
                >
                  {friendlyLabel}
                </span>
              ) : (
                <Link
                  to={routeTo}
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition"
                >
                  {friendlyLabel}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export default BreadcrumbsBar;
