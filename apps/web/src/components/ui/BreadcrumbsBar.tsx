import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../Icon';
import { useBreadcrumb } from '../../context/BreadcrumbContext';

const PATH_NAME_MAP: Record<string, string> = {
  '': 'Home',
  vacancies: 'Job Positions',
  'vacancy-requests': 'Vacancy Requests',
  applications: 'Applications',
  interviews: 'Interviews & Scheduling',
  calendar: 'Calendar',
  offers: 'Offers & Packages',
  candidates: 'Candidates DB',
  'cv-intake': 'Smart CV Intake',
  'cv-bank': 'CV Bank',
  'sourcing-match': 'Smart Sourcing & Match',
  'talent-pool': 'Smart Sourcing & Match',
  'talent-pools': 'Smart Sourcing & Match',
  reports: 'Reports & Analytics',
  analytics: 'Analytics',
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
  create: 'Create',
  'approval-inbox': 'Approvals Inbox',
  hires: 'Pre-Hire & Hires',
  joinings: 'Joinings Management',
  licenses: 'Licenses & Credentials',
  'candidate-documents': 'Candidate Documents',
  compare: 'Candidate Comparison',
  edit: 'Edit',
  view: 'Details',
  transition: 'Stage Transition',
  scorecard: 'Scorecard',
  documents: 'Documents',
  import: 'Bulk Import',
};

export function BreadcrumbsBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { customLabels } = useBreadcrumb();

  const pathnames = useMemo(() => {
    return location.pathname.split('/').filter(Boolean);
  }, [location.pathname]);

  // Don't render empty breadcrumb bar on root dashboard if user doesn't need navigation
  if (location.pathname === '/') {
    return null;
  }

  const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  const isCode = (str: string) => /^(APP|OFF|VAC|INT|REQ|CMD|USR|CAN)-[0-9A-Za-z-]+$/i.test(str);
  const isNumericOrShortId = (str: string) => /^\d{3,}$/.test(str) || /^[0-9a-f]{6,}$/i.test(str);

  const getContextualLabel = (segment: string, prevSegment: string): string => {
    if (isCode(segment)) {
      return segment;
    }

    const isId = isUUID(segment) || isNumericOrShortId(segment);
    if (isId) {
      switch (prevSegment.toLowerCase()) {
        case 'interviews':
          return 'Interview Details';
        case 'offers':
          return 'Offer Details';
        case 'applications':
          return 'Application Details';
        case 'candidates':
          return 'Candidate Profile';
        case 'vacancies':
          return 'Job Requisition';
        case 'vacancy-requests':
          return 'Requisition Request';
        case 'sourcing-match':
        case 'talent-pool':
        case 'talent-pools':
          return 'Position Match Details';
        case 'hires':
          return 'Hiring Case Details';
        case 'users':
          return 'User Details';
        default:
          return 'Details';
      }
    }

    return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
  };

  return (
    <nav
      aria-label="Breadcrumb"
      className="breadcrumbs-bar bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 py-2 z-20 shadow-2xs"
    >
      <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-7 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto rf-scrollbar">
          {/* Back Navigation Button */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-7 inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all border border-slate-200/80 dark:border-slate-700/80 shadow-2xs shrink-0 cursor-pointer group leading-none"
            title="Go back to previous page"
          >
            <Icon name="arrow-left" size={12} className="text-slate-500 dark:text-slate-400 group-hover:-translate-x-0.5 transition" />
            <span>Back</span>
          </button>

          {/* Clean Vertical Separator */}
          <span className="h-3.5 w-px bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" aria-hidden="true" />

          {/* Home Root */}
          <Link
            to="/" aria-label="Home"
            className="h-7 inline-flex items-center gap-1.5 px-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-[#0084ce] dark:hover:text-sky-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 text-xs font-medium transition-all no-underline shrink-0 leading-none"
          >
            <Icon name="dashboard" size={13} className="text-slate-400 dark:text-slate-500" />
            <span className="hidden sm:inline">Home</span>
          </Link>

          {/* Trail Crumbs */}
          {pathnames.map((segment, index) => {
            const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
            const isLast = index === pathnames.length - 1;
            const prevSegment = index > 0 ? pathnames[index - 1] : '';

            let friendlyLabel = customLabels[routeTo] || PATH_NAME_MAP[segment.toLowerCase()];
            if (!friendlyLabel) {
              friendlyLabel = getContextualLabel(segment, prevSegment);
            }

            return (
              <div key={routeTo} className="inline-flex items-center gap-1.5 shrink-0">
                <Icon name="chevron-right" size={12} className="text-slate-400 dark:text-slate-600 shrink-0 select-none" />
                {isLast ? (
                  <span
                    aria-current="page"
                    className="h-7 inline-flex items-center px-2.5 rounded-lg bg-sky-50/80 dark:bg-sky-950/60 text-[#0084ce] dark:text-sky-300 font-bold text-xs border border-sky-200/80 dark:border-sky-800/70 shrink-0 shadow-2xs leading-none"
                  >
                    {friendlyLabel}
                  </span>
                ) : (
                  <Link
                    to={routeTo}
                    className="h-7 inline-flex items-center px-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-[#0084ce] dark:hover:text-sky-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 text-xs font-medium transition-all no-underline shrink-0 leading-none"
                  >
                    {friendlyLabel}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export default BreadcrumbsBar;
