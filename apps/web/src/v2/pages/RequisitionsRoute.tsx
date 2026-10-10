import { lazy } from 'react';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { RequisitionsV2 } from './RequisitionsV2';

const VacancyRequestsPage = lazy(() => import('../../pages/VacancyRequestsPage').then((m) => ({ default: m.VacancyRequestsPage })));

/** /vacancy-requests: M1 for the v2 Manager seat; the v1 list otherwise (flag off, other seats). */
export function RequisitionsRoute() {
  return useV2Shell()?.seat === 'manager' ? <RequisitionsV2 /> : <VacancyRequestsPage />;
}
