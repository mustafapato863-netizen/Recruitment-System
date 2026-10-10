import { lazy } from 'react';
import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { MyWorkV2 } from './MyWorkV2';
import { TeamWorkV2 } from './TeamWorkV2';

const MyWorkPage = lazy(() => import('../../pages/MyWorkPage').then((m) => ({ default: m.MyWorkPage })));

/** /my-work: v2 My Work for the Employee seat, v2 Team work for the Manager seat (nav "Team work"); v1 page otherwise. */
export function MyWorkRoute() {
  const seat = useV2Shell()?.seat;
  return seat === 'employee' ? <MyWorkV2 /> : seat === 'manager' ? <TeamWorkV2 /> : <MyWorkPage />;
}
