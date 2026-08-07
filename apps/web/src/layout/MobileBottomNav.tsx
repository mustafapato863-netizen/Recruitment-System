import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';

interface MobileBottomNavProps {
  onToggleDrawer: () => void;
}

export function MobileBottomNav({ onToggleDrawer }: MobileBottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: 'dashboard' as const },
    { label: 'Inbox', path: '/approval-inbox', icon: 'inbox' as const },
    { label: 'Candidates', path: '/candidates', icon: 'users' as const },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.path}
            type="button"
            className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        className="mobile-bottom-nav-item"
        onClick={onToggleDrawer}
      >
        <Icon name="menu" size={20} />
        <span>Menu</span>
      </button>
    </nav>
  );
}
