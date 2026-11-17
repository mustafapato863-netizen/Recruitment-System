import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { TeamResultV2 } from './TeamResultV2';
import { RecruiterReportsV2 } from './RecruiterReportsV2';
import { AdminReportsV2 } from '../admin/AdminReportsV2';

/** /reports: E08 Reports for Recruiter; M4 Team result + Reports for Manager; A4 Admin Reports for Admin. */
export function ReportsRoute() {
  const seat = useV2Shell()?.seat;
  if (seat === 'admin') return <AdminReportsV2 />;
  if (seat === 'employee') return <RecruiterReportsV2 />;
  return <TeamResultV2 />;
}
