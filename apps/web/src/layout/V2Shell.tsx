import { useLayoutEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { applyUiVersion } from '../theme/uiVersion';
import { resolveSeat } from '../v2/seat';
import { AppShellV2 } from '../components/v2/shell/AppShellV2';

/**
 * v2 default: every signed-in seat (Employee, Manager, Admin, interviewer-only) gets the v2 shell. No ?ui=v2,
 * localStorage, VITE_UI_V2 or v2Seats switch, and the server's v2Enabled/v2Seats no longer bring back v1.
 */
export function V2Shell() {
  const { user, logout } = useAuth();
  useLayoutEffect(() => { applyUiVersion('v2'); }, []);
  if (!user) return <Outlet />;
  return <AppShellV2 user={user} seat={resolveSeat(user)} onSignOut={() => void logout()} />;
}
