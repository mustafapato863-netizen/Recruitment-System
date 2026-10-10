import { lazy } from 'react';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { TeamResultV2 } from './TeamResultV2';

const ReportsPage = lazy(() => import('../../pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));

/** /reports: M4 Team result for the v2 Manager seat (nav "Team result"); the v1 Reports page otherwise (Admin keeps Reports). */
export function ReportsRoute() {
  return useV2Shell()?.seat === 'manager' ? <TeamResultV2 /> : <ReportsPage />;
}
