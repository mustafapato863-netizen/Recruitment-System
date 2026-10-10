import { useAuth } from '../auth/AuthContext';
import { canUseMyInterviews } from '../auth/interviewer';
import { PageState } from '../components/ui/PageState';
import { MyInterviewsPage } from './MyInterviewsPage';

/** /my-interviews: interviewers only (INTERVIEWER role today, INTERVIEW_PARTICIPATE after B0b). */
export function MyInterviewsGate() {
  const { user } = useAuth();
  if (!canUseMyInterviews(user)) {
    return <PageState kind="forbidden" title="Access Restricted" description="My interviews is for users who interview candidates." />;
  }
  return <MyInterviewsPage />;
}
