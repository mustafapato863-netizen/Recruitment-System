import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  SlidersHorizontal,
  KeyRound,
  LogOut,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

export interface UserProfileDropdownProps {
  className?: string;
}

export function UserProfileDropdown({ className = '' }: UserProfileDropdownProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key and focus first item when opened
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      requestAnimationFrame(() => firstItemRef.current?.focus());
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await logout();
    navigate('/login');
  };

  const displayName = user?.displayName || user?.email || 'User';
  const roleTitle = user?.roles?.[0]?.name || 'Workspace Member';
  const userEmail = user?.email || '';
  const isAdmin = Boolean(user?.permissions?.includes('USERS_MANAGE') || user?.permissions?.includes('USERS_VIEW'));

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`.trim()}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`User menu for ${displayName}`}
        className="flex items-center gap-2.5 rounded-full p-1 sm:px-2.5 sm:py-1 transition-all hover:bg-rf-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rf-action cursor-pointer group"
      >
        {/* Blue Circular Avatar Badge */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rf-action text-rf-on-action text-xs font-extrabold shadow-xs">
          {getInitials(displayName)}
        </div>

        {/* User text column */}
        <div className="hidden flex-col text-left sm:flex">
          <span className="text-[13px] font-bold leading-tight text-rf-ink group-hover:text-rf-action transition-colors">
            {displayName}
          </span>
          <span className="text-[10.5px] font-semibold leading-tight text-rf-ink-muted mt-0.5">
            {roleTitle}
          </span>
        </div>

        {/* Down Chevron */}
        <ChevronDown
          className={`h-4 w-4 text-rf-ink-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-rf-action' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Floating Dropdown Card */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-label="User Account Menu"
          className="absolute right-0 top-full mt-2 w-72 origin-top-right rounded-2xl border border-rf-border-subtle bg-rf-surface/95 p-3.5 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header Section */}
          <div className="px-2 py-1.5">
            <h4 className="m-0 text-[14px] font-extrabold text-rf-ink leading-snug">
              {displayName}
            </h4>
            {userEmail && (
              <p className="m-0 mt-0.5 text-[12px] font-medium text-rf-ink-muted truncate">
                {userEmail}
              </p>
            )}

            {/* Access Badge */}
            <div className={`mt-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-semibold ${isAdmin ? 'text-rf-success' : 'text-rf-ink-muted'}`}>
              <ShieldCheck className={`h-4 w-4 shrink-0 ${isAdmin ? 'text-rf-success' : 'text-rf-ink-muted'}`} aria-hidden="true" />
              <span>{isAdmin ? 'Administrative Access' : 'Standard User Access'}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-rf-border-subtle" aria-hidden="true" />

          {/* Navigation Links */}
          <div className="space-y-0.5">
            <Link
              ref={firstItemRef}
              to="/profile"
              onClick={() => setIsOpen(false)}
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-rf-ink hover:bg-rf-surface-hover hover:text-rf-action transition-colors"
            >
              <User className="h-4 w-4 text-rf-ink-muted shrink-0" aria-hidden="true" />
              <span>User Profile</span>
            </Link>

            <Link
              to="/profile"
              onClick={() => setIsOpen(false)}
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-rf-ink hover:bg-rf-surface-hover hover:text-rf-action transition-colors"
            >
              <SlidersHorizontal className="h-4 w-4 text-rf-ink-muted shrink-0" aria-hidden="true" />
              <span>Preferences</span>
            </Link>

            <Link
              to="/profile"
              onClick={() => setIsOpen(false)}
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-rf-ink hover:bg-rf-surface-hover hover:text-rf-action transition-colors"
            >
              <KeyRound className="h-4 w-4 text-rf-ink-muted shrink-0" aria-hidden="true" />
              <span>Security &amp; Sessions</span>
            </Link>
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-rf-border-subtle" aria-hidden="true" />

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={handleSignOut}
            role="menuitem"
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-rf-danger hover:bg-rf-danger-soft transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4 text-rf-danger shrink-0" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default UserProfileDropdown;
