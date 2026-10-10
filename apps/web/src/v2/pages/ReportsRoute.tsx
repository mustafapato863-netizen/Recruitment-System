import { lazy } from 'react';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { TeamResultV2 } from './TeamResultV2';
import { AdminReportsV2 } from '../admin/AdminReportsV2';

const ReportsPage = lazy(() => import('../../pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));

/** /reports: M4 Team result for the v2 Manager seat (nav "Team result"); A4 Admin Reports for the v2 Admin seat; v1 otherwise. */
export function ReportsRoute() {
  const seat = useV2Shell()?.seat;
  return seat === 'manager' ? <TeamResultV2 /> : seat === 'admin' ? <AdminReportsV2 /> : <ReportsPage />;
}
