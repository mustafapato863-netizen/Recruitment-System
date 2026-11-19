import { Link } from 'react-router-dom';
import { ArrowUpRight, BriefcaseBusiness, CalendarCheck2, FileCheck2, FolderOpen, UsersRound } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

type Shortcut = {
  to: string;
  label: string;
  permission: string;
  icon: typeof ArrowUpRight;
  employeeOnly?: boolean;
};

/**
 * Contextual links for secondary, permission-gated recruitment workspaces.
 * Avoids overcrowding the primary V2 sidebar; a missing permission never
 * renders a link. The API + App.tsx remain the authorization authority.
 */
const LINKS: readonly Shortcut[] = [
  { to: '/offers', label: 'Offers', permission: 'APPLICATION_VIEW', icon: FileCheck2 },
  { to: '/hires', label: 'Hiring cases', permission: 'APPLICATION_VIEW', icon: BriefcaseBusiness },
  { to: '/joinings', label: 'Joinings', permission: 'APPLICATION_VIEW', icon: CalendarCheck2 },
  { to: '/cv-bank', label: 'CV bank', permission: 'CANDIDATE_VIEW', icon: FolderOpen, employeeOnly: true },
  { to: '/sourcing-match', label: 'Match skills', permission: 'CANDIDATE_VIEW', icon: UsersRound, employeeOnly: true },
];

export function WorkflowShortcutsV2({ seat }: { seat: 'employee' | 'manager' }) {
  const { user } = useAuth();
  const permissions = new Set(user?.permissions ?? []);
  const isAdmin = Boolean(user?.roles.some((r) => r.code === 'ADMINISTRATOR'));
  const links = LINKS.filter((item) => (!item.employeeOnly || seat === 'employee') && (isAdmin || permissions.has(item.permission)));
  if (!links.length) return null;
  return (
    <nav className="rf2-workflow-shortcuts" aria-label="Recruitment workflow shortcuts">
      <span className="rf2-workflow-shortcuts__label">Quick access</span>
      <div className="rf2-workflow-shortcuts__links">
        {links.map(({ to, label, icon: Icon }) => (
          <Link key={to} className="rf2-workflow-shortcuts__link" to={to}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
            <ArrowUpRight className="rf2-workflow-shortcuts__external" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </nav>
  );
}
