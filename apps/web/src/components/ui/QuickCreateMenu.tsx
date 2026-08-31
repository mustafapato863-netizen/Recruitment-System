import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Icon, type IconName } from '../Icon';

type QuickActionId = 'vacancy-request' | 'candidate' | 'cv-intake' | 'schedule-interview' | 'offer';

interface QuickAction {
  id: QuickActionId;
  label: string;
  description: string;
  icon: IconName;
  permission?: string;
  permissions?: readonly string[];
  destination: { kind: 'route'; to: string };
  contextHint?: string;
}

/** The only actions exposed by the authenticated Quick New surface. */
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
];

const MENU_ID = 'quick-create-menu';

export function QuickCreateMenu() {
  const { user } = useAuth();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLAnchorElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const actions = useMemo(
    () => QUICK_ACTIONS.filter((action) => {
      const requiredPermissions = action.permissions ?? (action.permission ? [action.permission] : []);
      return requiredPermissions.every((permission) => user?.permissions.includes(permission));
    }),
    [user],
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
