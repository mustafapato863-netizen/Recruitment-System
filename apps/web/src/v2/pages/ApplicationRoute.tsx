import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { ApplicationFileV2 } from './ApplicationFileV2';

/** /applications/:id: the v2 file (E13). Employee = owner view; Manager = the same file read-only with the offer decision (Figma 09). */
export function ApplicationRoute() {
  return useV2Shell()?.seat === 'manager' ? <ApplicationFileV2 mode="manager" /> : <ApplicationFileV2 />;
}
