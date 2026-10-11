import { useV2Shell } from '../../components/v2/shell/AppShellV2';
import { MyWorkV2 } from './MyWorkV2';
import { TeamWorkV2 } from './TeamWorkV2';

/** /my-work: My Work for the Employee seat, Team work for the Manager seat (nav "Team work"). Admin is redirected to /users by the shell. */
export function MyWorkRoute() {
  return useV2Shell()?.seat === 'manager' ? <TeamWorkV2 /> : <MyWorkV2 />;
}
