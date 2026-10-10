import { lazy } from 'react';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { MyWorkV2 } from './MyWorkV2';

const MyWorkPage = lazy(() => import('../../pages/MyWorkPage').then((m) => ({ default: m.MyWorkPage })));

/** /my-work: v2 My Work only inside the v2 shell for the Employee seat; v1 page otherwise. */
export function MyWorkRoute() {
  const shell = useV2Shell();
  return shell?.seat === 'employee' ? <MyWorkV2 /> : <MyWorkPage />;
}
