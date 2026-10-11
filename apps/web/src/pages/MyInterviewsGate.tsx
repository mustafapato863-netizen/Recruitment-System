import { useAuth } from '../auth/AuthContext';
import { canUseMyInterviews } from '../auth/interviewer';
import { PageState } from '../components/ui/PageState';
import { MyInterviewsPage } from './MyInterviewsPage';
import { resolveSeat } from '../v2/seat';

/** /my-interviews: interviewers only (INTERVIEWER role today, INTERVIEW_PARTICIPATE after B0b). */
export function MyInterviewsGate() {
  const { user } = useAuth();
  // The Manager seat may always open its own interview scorecards here (Team work → Waiting on you; old /interviews/:id links).
  if (!canUseMyInterviews(user) && resolveSeat(user) !== 'manager') {
    return <PageState kind="forbidden" title="Access Restricted" description="My interviews is for users who interview candidates." />;
  }
  return <MyInterviewsPage />;
}
