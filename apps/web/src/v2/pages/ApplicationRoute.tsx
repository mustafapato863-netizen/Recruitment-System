import { lazy } from 'react';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { ApplicationFileV2 } from './ApplicationFileV2';

const ApplicationDetailPage = lazy(() => import('../../pages/ApplicationDetailPage').then((m) => ({ default: m.ApplicationDetailPage })));

/** /applications/:id: the v2 file (E13) inside the v2 shell for the Employee seat; v1 page otherwise. */
export function ApplicationRoute() {
  const shell = useV2Shell();
  return shell?.seat === 'employee' ? <ApplicationFileV2 /> : <ApplicationDetailPage />;
}
