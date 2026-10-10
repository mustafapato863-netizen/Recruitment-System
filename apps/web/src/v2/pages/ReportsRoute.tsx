import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { TeamResultV2 } from './TeamResultV2';
import { AdminReportsV2 } from '../admin/AdminReportsV2';

/** /reports: M4 Team result for the Manager seat; A4 Admin Reports for the Admin seat. */
export function ReportsRoute() {
  return useV2Shell()?.seat === 'admin' ? <AdminReportsV2 /> : <TeamResultV2 />;
}
