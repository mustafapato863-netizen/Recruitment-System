import { useAuth } from '../../auth/AuthContext';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { loadApproverFile } from '../api/applicationFile';
import { ApplicationFileV2 } from './ApplicationFileV2';

/** True for a final-hire approver who can't otherwise read files (#34: read-only while their approval is pending). */
export function isFileApproverOnly(user: { permissions?: readonly string[]; roles?: ReadonlyArray<{ code: string }> } | null | undefined): boolean {
  const p = user?.permissions ?? [];
  const admin = (user?.roles ?? []).some((r) => r.code === 'ADMINISTRATOR');
  return !admin && !p.includes('APPLICATION_VIEW') && p.includes('FINAL_HIRING_APPROVAL');
}

/**
 * /applications/:id: the v2 file (E13). Employee = owner view; Manager = the same file read-only with the offer
 * decision (Figma 09); a final-hire approver without APPLICATION_VIEW = read-only approver view.
 */
export function ApplicationRoute() {
  const { user } = useAuth();
  const seat = useV2Shell()?.seat;
  if (isFileApproverOnly(user)) return <ApplicationFileV2 mode="approver" load={loadApproverFile} />;
  return seat === 'manager' ? <ApplicationFileV2 mode="manager" /> : <ApplicationFileV2 />;
}
