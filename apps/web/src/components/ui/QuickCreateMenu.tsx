import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Icon, type IconName } from '../Icon';

type QuickActionId =
  | 'vacancy-request'
  | 'candidate'
  | 'cv-intake'
  | 'schedule-interview'
  | 'offer'
  | 'candidate-from-vacancy'
  | 'interview-from-application'
  | 'offer-from-application'
  | 'hiring-case-from-offer'
  | 'onboarding-from-hiring-case';

interface QuickAction {
  id: QuickActionId;
  label: string;
  description: string;
  icon: IconName;
  permission?: string;
  permissions?: readonly string[];
  destination: { kind: 'route'; to: string };
  contextHint?: string;
  requiresContext?: boolean;
  contextTypes?: string[]; // What context types this action can work with
}

/** Context-aware Quick Actions for F5 enhancement */
const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    id: 'vacancy-request',
    label: 'Vacancy request',
    description: 'Request approved hiring demand',
    icon: 'file-text',
    permission: 'VACANCY_REQUEST_CREATE',
    destination: { kind: 'route', to: '/vacancy-requests/create' },
  },
  {
    id: 'candidate',
    label: 'Candidate',
    description: 'Create a candidate identity',
    icon: 'user',
    permission: 'CANDIDATE_CREATE',
    destination: { kind: 'route', to: '/candidates?create=1' },
  },
  {
    id: 'cv-intake',
    label: 'CV intake',
    description: 'Import candidate documents',
    icon: 'upload',
    permission: 'CANDIDATE_CREATE',
    destination: { kind: 'route', to: '/cv-intake' },
  },
  {
    id: 'schedule-interview',
    label: 'Schedule interview',
    description: 'Coordinate interviewers and timing',
    permissions: ['VACANCY_VIEW', 'APPLICATION_MOVE_STAGE'],
    contextHint: 'Choose an application on the next screen',
    icon: 'calendar',
    destination: { kind: 'route', to: '/interviews?create=1' },
  },
  {
    id: 'offer',
    label: 'Offer',
    description: 'Draft an offer for an application',
    permission: 'APPLICATION_MOVE_STAGE',
    contextHint: 'Choose an application on the next screen',
    icon: 'offer',
    destination: { kind: 'route', to: '/offers/create' },
  },
  // Context-aware actions (F5 enhancement)
  {
    id: 'candidate-from-vacancy',
    label: 'Candidate from vacancy',
    description: 'Create candidate for this vacancy',
    icon: 'user',
    permission: 'CANDIDATE_CREATE',
    destination: { kind: 'route', to: '/candidates?create=1' },
    contextHint: 'Pre-filled with vacancy context',
    requiresContext: true,
    contextTypes: ['vacancy'],
  },
  {
    id: 'interview-from-application',
    label: 'Interview from application',
    description: 'Schedule interview for this application',
    icon: 'calendar-clock',
    permissions: ['VACANCY_VIEW', 'APPLICATION_MOVE_STAGE'],
    destination: { kind: 'route', to: '/interviews?create=1' },
    contextHint: 'Pre-filled with application context',
    requiresContext: true,
    contextTypes: ['application'],
  },
  {
    id: 'offer-from-application',
    label: 'Offer from application',
    description: 'Make offer for this application',
    icon: 'document',
    permission: 'APPLICATION_MOVE_STAGE',
    destination: { kind: 'route', to: '/offers/create' },
    contextHint: 'Pre-filled with application context',
    requiresContext: true,
    contextTypes: ['application'],
  },
  {
    id: 'hiring-case-from-offer',
    label: 'Hiring case from offer',
    description: 'Start hiring process for this offer',
    icon: 'check-circle',
    permission: 'APPLICATION_VIEW',
    destination: { kind: 'route', to: '/hires?create=1' },
    contextHint: 'Pre-filled with offer context',
    requiresContext: true,
    contextTypes: ['offer'],
  },
  {
    id: 'onboarding-from-hiring-case',
    label: 'Onboarding from hiring case',
    description: 'Begin onboarding for this hiring case',
    icon: 'user-check',
    permission: 'APPLICATION_VIEW',
    destination: { kind: 'route', to: '/joinings?create=1' },
    contextHint: 'Pre-filled with hiring case context',
    requiresContext: true,
    contextTypes: ['hiring-case'],
  },
];

const MENU_ID = 'quick-create-menu';

export function QuickCreateMenu() {
  const { user } = useAuth();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLAnchorElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Extract context from URL for context-aware actions
  const context = useMemo(() => {
    const pathname = location.pathname;

    // Check for vacancy context
    if (pathname.startsWith('/vacancies/') && !pathname.endsWith('/create')) {
      const vacancyId = pathname.split('/')[2];
      if (vacancyId && vacancyId !== '') {
        return { type: 'vacancy', id: vacancyId };
      }
    }

    // Check for application context
    if (pathname.startsWith('/applications/') && !pathname.endsWith('/create')) {
      const applicationId = pathname.split('/')[2];
      if (applicationId && applicationId !== '') {
        return { type: 'application', id: applicationId };
      }
    }

    // Check for offer context
    if (pathname.startsWith('/offers/') && !pathname.endsWith('/create') && !pathname.endsWith('/approvals')) {
      const offerId = pathname.split('/')[2];
      if (offerId && offerId !== '') {
        return { type: 'offer', id: offerId };
      }
    }

    // Check for hiring case context
    if (pathname.startsWith('/hires/') && !pathname.endsWith('/create') && !pathname.endsWith('/approvals')) {
      const hiringCaseId = pathname.split('/')[2];
      if (hiringCaseId && hiringCaseId !== '') {
        return { type: 'hiring-case', id: hiringCaseId };
      }
    }

    return null;
  }, [location.pathname]);

  const actions = useMemo(
    () => {
      // Filter actions by permissions first
      const permittedActions = QUICK_ACTIONS.filter((action) => {
        const requiredPermissions = action.permissions ?? (action.permission ? [action.permission] : []);
        return requiredPermissions.every((permission) => user?.permissions.includes(permission));
      });

      // Then filter by context awareness
      return permittedActions.filter((action) => {
        // If action doesn't require context, always show it
        if (!action.requiresContext) return true;

        // If action requires context but we have no context, don't show it
        if (!context) return false;

        // If action requires context, check if context matches
        return action.contextTypes?.includes(context.type) ?? false;
      });
    },
    [user, context]
  );

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    closeMenu();
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || !menuRef.current?.contains(target)) closeMenu();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
      }
    };

    requestAnimationFrame(() => firstActionRef.current?.focus());
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  if (actions.length === 0) return null;

  return (
    <div className="quick-create" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        className="header-new-action"
        aria-haspopup="menu"
        aria-controls={MENU_ID}
        aria-expanded={isOpen}
        onClick={() => {
          if (isOpen) closeMenu(true);
          else setIsOpen(true);
        }}
      >
        <Icon name="plus" size={14} />
        <span>New</span>
        {context && (
          <span className="ml-2 text-xs text-rf-ink-muted">
            ({context.type === 'vacancy' ? 'In vacancy' :
              context.type === 'application' ? 'In application' :
              context.type === 'offer' ? 'In offer' :
              context.type === 'hiring-case' ? 'In hiring case' : ''})
          </span>
        )}
      </button>
      {isOpen && (
        <div id={MENU_ID} className="quick-create__menu" role="menu" aria-label="Create new">
          <div className="quick-create__heading">Create new</div>
          {actions.map((action, index) => (
            <Link
              key={action.id}
              ref={index === 0 ? firstActionRef : undefined}
              to={action.destination.to}
              role="menuitem"
              onClick={() => closeMenu()}
            >
              <span className="quick-create__icon"><Icon name={action.icon} size={16} /></span>
              <span>
                <strong>{action.label}</strong>
                <small>{action.description}</small>
                {action.contextHint && <small className="quick-create__context">{action.contextHint}</small>}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}