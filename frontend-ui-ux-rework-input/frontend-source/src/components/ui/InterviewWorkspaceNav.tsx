import { NavLink, Link } from 'react-router-dom';
import { Button } from './Button';
import { Icon } from '../Icon';

interface InterviewWorkspaceNavProps {
  canSchedule?: boolean;
}

/** Shared workspace switcher for the interview list and calendar surfaces. */
export function InterviewWorkspaceNav({ canSchedule = false }: InterviewWorkspaceNavProps) {
  return (
    <div className="rf-interview-workspace-nav" aria-label="Interview workspace">
      <div className="rf-interview-workspace-nav__tabs" role="tablist" aria-label="Interview views">
        <NavLink
          to="/interviews"
          end
          className={({ isActive }) => `rf-interview-workspace-nav__tab${isActive ? ' is-active' : ''}`}
          role="tab"
          aria-label="Interview list"
        >
          <Icon name="list" size={14} />
          Interviews
        </NavLink>
        <NavLink
          to="/interviews/calendar"
          className={({ isActive }) => `rf-interview-workspace-nav__tab${isActive ? ' is-active' : ''}`}
          role="tab"
          aria-label="Interview calendar"
        >
          <Icon name="calendar" size={14} />
          Calendar
        </NavLink>
      </div>
      {canSchedule && (
        <Button variant="primary" size="sm" asChild>
          <Link to="/interviews?create=1">
            <Icon name="plus" size={14} />
            Schedule interview
          </Link>
        </Button>
      )}
    </div>
  );
}
