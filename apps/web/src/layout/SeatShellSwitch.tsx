import { useLayoutEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { applyUiVersion } from '../theme/uiVersion';
import { resolveSeat } from '../v2/seat';
import { shouldUseV2ShellInBrowser } from '../v2/seatSwitch';
import { AppShell } from './AppShell';
import { AppShellV2 } from '../components/v2/shell/AppShellV2';

/**
 * F4 seat-by-seat switch. v2 shell only when the v2 flag is on AND the user's
 * seat is enabled; otherwise the v1 AppShell renders exactly as before and the
 * v2 tokens are switched off for the signed-in app.
 */
export function SeatShellSwitch({ decide = shouldUseV2ShellInBrowser }: { decide?: typeof shouldUseV2ShellInBrowser } = {}) {
  const { user, logout } = useAuth();
  const seat = resolveSeat(user);
  const useV2 = Boolean(user) && decide(seat, user);

  useLayoutEffect(() => {
    applyUiVersion(useV2 ? 'v2' : 'v1');
  }, [useV2]);

  if (!useV2 || !user) return <AppShell />;
  return <AppShellV2 user={user} seat={seat} onSignOut={() => void logout()} />;
}
