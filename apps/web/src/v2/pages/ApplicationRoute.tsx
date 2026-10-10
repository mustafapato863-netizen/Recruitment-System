import { lazy } from 'react';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { ApplicationFileV2 } from './ApplicationFileV2';

const ApplicationDetailPage = lazy(() => import('../../pages/ApplicationDetailPage').then((m) => ({ default: m.ApplicationDetailPage })));

/**
 * /applications/:id: the v2 file (E13) inside the v2 shell. Employee = owner view; Manager = the same file read-only, where the
 * offer decision opens (B2-18/B2-23, Figma 09 "Approval on the same file"). v1 page outside the v2 shell.
 */
export function ApplicationRoute() {
  const shell = useV2Shell();
  if (shell?.seat === 'employee') return <ApplicationFileV2 />;
  if (shell?.seat === 'manager') return <ApplicationFileV2 mode="manager" />;
  return <ApplicationDetailPage />;
}
